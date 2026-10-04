"""Reminder email orchestration: delivery state machine and runner.

Two campaigns (see ``reminder_campaigns.py``) share one pipeline. Each user,
campaign and campaign key (inactivity cycle or plan-year start) has exactly one
delivery record, ``users/{uid}/reminder_deliveries/{campaign}-{key}``. The
``decide_*`` functions are the only place delivery transitions are defined; the
Firestore repository applies them inside transactions and the in-memory test
repository applies the very same functions.

External I/O (Firebase Auth lookups, the email provider) never happens inside a
transaction. Firestore, Auth, email, and both clocks are injected.
"""

from __future__ import annotations

import hashlib
import time
from dataclasses import dataclass
from datetime import date, datetime, timedelta, timezone
from typing import Any, Callable, Iterable, Optional
from uuid import uuid4

from email_delivery import EmailDeliveryError


INACTIVITY_PERIOD = timedelta(days=90)
LEASE_DURATION = timedelta(minutes=5)
# Resend keeps an idempotency key for 24 hours; finalize uncertain sends before it lapses.
IDEMPOTENCY_WINDOW = timedelta(hours=23)
MAX_ATTEMPTS = 5
MAX_BATCH_SIZE = 25
DEFAULT_BUDGET_SECONDS = 45.0

TERMINAL_STATUSES = frozenset({"sent", "permanent_failed", "delivery_unknown"})
LEASED_STATUSES = frozenset({"claimed", "sending"})
CAMPAIGN_ORDER = ("inactivity", "benefits")

COUNT_KEYS = ("candidates", "sent", "would_send", "already_terminal", "leased",
              "skipped_auth", "stale", "retryable_failed", "permanent_failed")


def utc(value: datetime) -> datetime:
    return value.astimezone(timezone.utc)


def is_inactive(last_sign_in_at: Optional[datetime], now: datetime) -> bool:
    """True once 90 full days have elapsed since the last recorded sign-in."""
    if last_sign_in_at is None:
        return False
    return utc(now) - utc(last_sign_in_at) >= INACTIVITY_PERIOD


def delivery_idempotency_key(campaign: str, uid: str, key: str) -> str:
    """Stable provider key that never exposes the uid or campaign key."""
    digest = hashlib.sha256(f"{uid}\0{key}".encode("utf-8")).hexdigest()
    return f"{campaign}-reminder/{digest}"


@dataclass(frozen=True)
class ReminderCandidate:
    """One user who looked eligible for one campaign period at query time."""

    campaign: str
    uid: str
    key: str
    eligible_at: datetime
    employee_id: Optional[str] = None
    plan_year_label: Optional[str] = None
    resets_on: Optional[date] = None

    @property
    def doc_id(self) -> str:
        return f"{self.campaign}-{self.key}"

    @property
    def idempotency_key(self) -> str:
        return delivery_idempotency_key(self.campaign, self.uid, self.key)


# --------------------------------------------------------------------------- #
# Delivery state machine (pure)
# --------------------------------------------------------------------------- #

def _lease_live(delivery: dict[str, Any], now: datetime) -> bool:
    expires = delivery.get("lease_expires_at")
    return (delivery.get("status") in LEASED_STATUSES and bool(delivery.get("lease_owner"))
            and expires is not None and utc(expires) > utc(now))


def _expired_first_attempt(delivery: dict[str, Any], now: datetime) -> bool:
    first = delivery.get("first_attempt_at")
    return first is not None and utc(now) - utc(first) >= IDEMPOTENCY_WINDOW


def _cleared_lease() -> dict[str, Any]:
    return {"lease_owner": None, "lease_expires_at": None}


def decide_claim(delivery: Optional[dict[str, Any]], candidate: ReminderCandidate,
                 job_id: str, now: datetime) -> tuple[str, Optional[dict[str, Any]]]:
    """Return (outcome, fields to merge) for a claim attempt.

    Outcomes: ``claimed`` (proceed), ``terminal`` (never send again),
    ``leased`` (another run holds it). Eligibility has already been rechecked.
    """
    delivery = delivery or {}
    status = delivery.get("status")
    if status in TERMINAL_STATUSES:
        return "terminal", None
    if _lease_live(delivery, now):
        return "leased", None
    interrupted = status == "sending"
    uncertain = status == "retryable_failed" and delivery.get("failure_uncertain")
    if (interrupted or uncertain) and _expired_first_attempt(delivery, now):
        return "terminal", {"status": "delivery_unknown",
                            "failure_code": "idempotency_window_expired",
                            "last_checked_at": now, **_cleared_lease()}
    if status == "retryable_failed" and int(delivery.get("attempt_count") or 0) >= MAX_ATTEMPTS:
        return "terminal", {"status": "permanent_failed", "failure_code": "retry_limit",
                            "last_checked_at": now, **_cleared_lease()}
    return "claimed", {
        "campaign": candidate.campaign,
        "campaign_key": candidate.key,
        "eligible_at": candidate.eligible_at,
        "status": "claimed",
        "idempotency_key": candidate.idempotency_key,
        "lease_owner": job_id,
        "lease_expires_at": now + LEASE_DURATION,
        "attempt_count": int(delivery.get("attempt_count") or 0),
        "first_attempt_at": delivery.get("first_attempt_at"),
        "last_checked_at": now,
    }


def decide_sending(delivery: Optional[dict[str, Any]], job_id: str,
                   now: datetime) -> Optional[dict[str, Any]]:
    """Fields for the claimed -> sending step, or None when the lease was lost."""
    if (not delivery or delivery.get("status") != "claimed"
            or delivery.get("lease_owner") != job_id or not _lease_live(delivery, now)):
        return None
    return {
        "status": "sending",
        "attempt_count": int(delivery.get("attempt_count") or 0) + 1,
        "first_attempt_at": delivery.get("first_attempt_at") or now,
        "last_attempt_at": now,
        "lease_expires_at": now + LEASE_DURATION,
    }


def decide_sent(delivery: Optional[dict[str, Any]], provider_message_id: str,
                now: datetime) -> Optional[dict[str, Any]]:
    """The provider accepted the email: always record it unless already sent."""
    if delivery and delivery.get("status") == "sent":
        return None
    return {"status": "sent", "provider_message_id": provider_message_id, "sent_at": now,
            "failure_code": None, "failure_uncertain": False, **_cleared_lease()}


def decide_failure(delivery: Optional[dict[str, Any]], error: EmailDeliveryError,
                   now: datetime) -> dict[str, Any]:
    delivery = delivery or {}
    if delivery.get("status") in TERMINAL_STATUSES:
        return {}
    first = delivery.get("first_attempt_at") or now
    attempts = int(delivery.get("attempt_count") or 0)
    code = error.code
    if error.uncertain and utc(now) - utc(first) >= IDEMPOTENCY_WINDOW:
        status, code = "delivery_unknown", "idempotency_window_expired"
    elif error.retryable and not error.uncertain and attempts >= MAX_ATTEMPTS:
        status, code = "permanent_failed", "retry_limit"
    elif error.retryable:
        status = "retryable_failed"
    else:
        status = "permanent_failed"
    return {"status": status, "failure_code": code, "failure_uncertain": bool(error.uncertain),
            "last_attempt_at": now, **_cleared_lease()}


def decide_skip(delivery: Optional[dict[str, Any]], code: str, candidate: ReminderCandidate,
                now: datetime) -> Optional[dict[str, Any]]:
    """Audit an account that cannot be emailed now. Never overwrite progress."""
    delivery = delivery or {}
    status = delivery.get("status")
    if status in TERMINAL_STATUSES or status == "sending" or _lease_live(delivery, now):
        return None
    if status == "retryable_failed":
        # Keep the attempt history (and its idempotency clock); only note the check.
        return {"last_checked_at": now}
    return {"campaign": candidate.campaign, "campaign_key": candidate.key,
            "eligible_at": candidate.eligible_at, "status": "skipped_auth",
            "failure_code": code, "last_checked_at": now}


# --------------------------------------------------------------------------- #
# Runner
# --------------------------------------------------------------------------- #

def auth_skip_code(user: Any, *, allow_unverified: bool = False) -> Optional[str]:
    if user is None:
        return "missing_account"
    if getattr(user, "disabled", False):
        return "disabled"
    if not getattr(user, "email", None):
        return "missing_email"
    if not getattr(user, "email_verified", False) and not allow_unverified:
        return "unverified_email"
    return None


class _AuthLookupFailed:
    """Sentinel cached when an Auth lookup raised."""


class ReminderRunner:
    """Evaluate campaigns and hand eligible reminders to the email provider."""

    def __init__(self, repository, auth_lookup: Callable[[str], Any], sender,
                 clock: Callable[[], datetime], *, sign_in_url: str = "",
                 monotonic: Callable[[], float] = time.monotonic,
                 budget_seconds: float = DEFAULT_BUDGET_SECONDS,
                 allow_unverified: bool = False):
        self.repository = repository
        self.auth_lookup = auth_lookup
        self.sender = sender
        self.clock = clock
        self.sign_in_url = sign_in_url
        self.monotonic = monotonic
        self.budget_seconds = budget_seconds
        self.allow_unverified = allow_unverified

    def _now(self) -> datetime:
        return utc(self.clock())

    def run(self, campaigns: Iterable[Any], *, batch_size: int = MAX_BATCH_SIZE,
            dry_run: bool = False) -> dict[str, Any]:
        batch_size = max(1, min(int(batch_size), MAX_BATCH_SIZE))
        started = self.monotonic()
        job_id = str(uuid4())
        run_at = self._now()
        auth_cache: dict[str, Any] = {}
        result: dict[str, Any] = {"job_run_id": job_id, "dry_run": dry_run,
                                  "incomplete": False, "campaigns": {}}
        for campaign in campaigns:
            counts = {key: 0 for key in COUNT_KEYS}
            counts["incomplete"] = False
            result["campaigns"][campaign.name] = counts
            claimed = 0
            for candidate in campaign.candidates(self.repository, run_at):
                counts["candidates"] += 1
                existing = self.repository.delivery(candidate)
                if existing and existing.get("status") in TERMINAL_STATUSES:
                    counts["already_terminal"] += 1
                    continue
                user = self._lookup(candidate.uid, auth_cache)
                code = ("auth_lookup_failed" if user is _AuthLookupFailed
                        else auth_skip_code(user, allow_unverified=self.allow_unverified))
                if code:
                    if not dry_run:
                        self.repository.record_skip(candidate, code, self._now())
                    counts["skipped_auth"] += 1
                    continue
                if claimed >= batch_size or self.monotonic() - started >= self.budget_seconds:
                    counts["incomplete"] = result["incomplete"] = True
                    break
                if dry_run:
                    claimed += 1
                    counts["would_send"] += 1
                    continue
                outcome = self.repository.claim(campaign, candidate, job_id, self._now())
                if outcome == "stale":
                    counts["stale"] += 1
                    continue
                if outcome == "terminal":
                    counts["already_terminal"] += 1
                    continue
                if outcome == "leased":
                    counts["leased"] += 1
                    continue
                claimed += 1
                if not self.repository.mark_sending(candidate, job_id, self._now()):
                    counts["leased"] += 1
                    continue
                message = campaign.message(candidate, self.sign_in_url)
                try:
                    provider_id = self.sender.send(to=user.email, message=message,
                                                   idempotency_key=candidate.idempotency_key)
                except EmailDeliveryError as error:
                    self.repository.mark_failure(candidate, error, self._now())
                    counts["retryable_failed" if error.retryable else "permanent_failed"] += 1
                    continue
                self.repository.mark_sent(candidate, provider_id, self._now())
                counts["sent"] += 1
        return result

    def _lookup(self, uid: str, cache: dict[str, Any]) -> Any:
        if uid not in cache:
            try:
                cache[uid] = self.auth_lookup(uid)
            except Exception:  # noqa: BLE001 - only a redacted category is kept
                cache[uid] = _AuthLookupFailed
        return cache[uid]


def ordered_campaigns(names: Iterable[str]) -> list[str]:
    wanted = set(names)
    return [name for name in CAMPAIGN_ORDER if name in wanted]
