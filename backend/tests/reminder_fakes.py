"""Fakes shared by the reminder tests.

``MemoryReminderRepository`` applies the real ``reminders.decide_*`` rules, so
the runner is tested against the same state machine Firestore uses.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone

import reminders

NOW = datetime(2026, 10, 4, 12, tzinfo=timezone.utc)


@dataclass
class FakeAuthUser:
    email: str | None = "person@example.com"
    email_verified: bool = True
    disabled: bool = False


class FakeClock:
    def __init__(self, value: datetime = NOW):
        self.value = value

    def __call__(self) -> datetime:
        return self.value


class FakeMonotonic:
    """Advances by ``step`` seconds on every reading."""

    def __init__(self, step: float = 0.0):
        self.value = 0.0
        self.step = step

    def __call__(self) -> float:
        current = self.value
        self.value += self.step
        return current


class FakeEmailSender:
    def __init__(self, error=None):
        self.calls = []
        self.error = error

    def send(self, *, to, message, idempotency_key):
        self.calls.append({"to": to, "message": message, "idempotency_key": idempotency_key})
        if self.error:
            raise self.error
        return f"provider-message-{len(self.calls)}"


class MemoryReminderRepository:
    def __init__(self, profiles=(), reports=None):
        self.profiles = {profile.uid: profile for profile in profiles}
        self.reports = dict(reports or {})
        self.deliveries: dict[tuple[str, str], dict] = {}
        self.writes = 0
        self.before_claim = None
        self.before_sending = None

    # -- data reads -------------------------------------------------------- #

    def inactive_profiles(self, cutoff):
        return sorted((p for p in self.profiles.values()
                       if p.last_sign_in_at is not None and p.last_sign_in_at <= cutoff),
                      key=lambda p: p.last_sign_in_at)

    def company_profiles(self, companies):
        return sorted((p for p in self.profiles.values() if p.company in set(companies)),
                      key=lambda p: p.uid)

    def care_reports(self, uid, employee_id):
        return list(self.reports.get((uid, employee_id), []))

    def delivery(self, candidate):
        found = self.deliveries.get((candidate.uid, candidate.doc_id))
        return dict(found) if found else None

    # -- transitions ------------------------------------------------------- #

    def _merge(self, candidate, fields):
        if fields:
            self.writes += 1
            self.deliveries.setdefault((candidate.uid, candidate.doc_id), {}).update(fields)

    def record_skip(self, candidate, code, now):
        self._merge(candidate, reminders.decide_skip(self.delivery(candidate), code, candidate, now))

    def claim(self, campaign, candidate, job_id, now):
        if self.before_claim:
            self.before_claim(self, candidate)
        profile = self.profiles.get(candidate.uid)
        employee_id = campaign.care_employee_id(profile) if profile else None
        reports = self.care_reports(candidate.uid, employee_id) if employee_id else None
        if not campaign.recheck(profile, reports, candidate, now):
            return "stale"
        outcome, fields = reminders.decide_claim(self.delivery(candidate), candidate, job_id, now)
        self._merge(candidate, fields)
        return outcome

    def mark_sending(self, candidate, job_id, now):
        if self.before_sending:
            self.before_sending(self, candidate)
        fields = reminders.decide_sending(self.delivery(candidate), job_id, now)
        self._merge(candidate, fields)
        return fields is not None

    def mark_sent(self, candidate, provider_message_id, now):
        self._merge(candidate, reminders.decide_sent(self.delivery(candidate), provider_message_id, now))

    def mark_failure(self, candidate, error, now):
        self._merge(candidate, reminders.decide_failure(self.delivery(candidate), error, now))
