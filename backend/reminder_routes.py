"""Internal reminder email job, called daily by Cloud Scheduler.

    POST /api/internal/reminders/run
        body (all optional): {"campaigns": ["inactivity", "benefits"],
                              "batch_size": 1..25, "dry_run": false}

Responses carry counts only. 503 tells Cloud Scheduler to retry: the job is not
configured, a send failed in a retryable way, or a batch/time budget was hit.
See ``specs/009-email-reminders/contracts/api.md``.
"""

from __future__ import annotations

import logging
import os
from datetime import datetime, timezone
from typing import Any

from firebase_admin import auth as firebase_auth
from flask import Blueprint, jsonify, request

from auth import require_scheduler
from chat_profiles import load_profiles
from email_delivery import EmailDeliveryError, ResendEmailSender
from reminder_campaigns import (DEFAULT_LEAD_MONTHS, DEFAULT_REMAINING_PERCENT, BenefitsCampaign,
                                InactivityCampaign)
from reminders import CAMPAIGN_ORDER, MAX_BATCH_SIZE, ReminderRunner, ordered_campaigns
import store

logger = logging.getLogger("dental.reminders")

reminders_bp = Blueprint("reminders", __name__)

_BODY_KEYS = {"campaigns", "batch_size", "dry_run"}


class ReminderConfigError(Exception):
    pass


def env_flag(name: str) -> bool:
    return os.environ.get(name, "").strip().lower() in ("1", "true", "yes")


def _env_int(name: str, default: int, low: int, high: int) -> int:
    raw = os.environ.get(name, "").strip()
    if not raw:
        return default
    try:
        value = int(raw)
    except ValueError:
        raise ReminderConfigError(name) from None
    if not low <= value <= high:
        raise ReminderConfigError(name)
    return value


def auth_lookup(uid: str):
    try:
        return firebase_auth.get_user(uid)
    except firebase_auth.UserNotFoundError:
        return None


def build_campaigns(names: list[str]) -> list[Any]:
    lead = _env_int("REMINDER_BENEFITS_LEAD_MONTHS", DEFAULT_LEAD_MONTHS, 1, 11)
    percent = _env_int("REMINDER_BENEFITS_REMAINING_PERCENT", DEFAULT_REMAINING_PERCENT, 1, 100)
    campaigns: list[Any] = []
    for name in ordered_campaigns(names):
        if name == "inactivity":
            campaigns.append(InactivityCampaign())
        else:
            campaigns.append(BenefitsCampaign(load_profiles(os.environ.get("CHAT_FIXTURE_PATH")),
                                              lead_months=lead, remaining_percent=percent))
    return campaigns


def _run_reminder_job(campaigns: list[str], batch_size: int, dry_run: bool) -> dict[str, Any]:
    sender = None if dry_run else ResendEmailSender.from_environment()
    built = build_campaigns(campaigns)
    runner = ReminderRunner(
        store.FirestoreReminderRepository(), auth_lookup, sender,
        clock=lambda: datetime.now(timezone.utc),
        sign_in_url=sender.sign_in_url if sender else "",
        allow_unverified=env_flag("REMINDER_ALLOW_UNVERIFIED"))
    return runner.run(built, batch_size=batch_size, dry_run=dry_run)


# Indirection so route tests can replace the job without touching Firestore.
run_reminder_job = _run_reminder_job


def _parse_body(body: Any) -> tuple[list[str], int, bool]:
    if not isinstance(body, dict) or set(body) - _BODY_KEYS:
        raise ValueError("Send an object with only campaigns, batch_size and dry_run.")
    campaigns = body.get("campaigns", list(CAMPAIGN_ORDER))
    if (not isinstance(campaigns, list) or not campaigns
            or any(name not in CAMPAIGN_ORDER for name in campaigns)
            or len(set(campaigns)) != len(campaigns)):
        raise ValueError("campaigns must be a non-empty list of inactivity and/or benefits.")
    batch_size = body.get("batch_size", MAX_BATCH_SIZE)
    if type(batch_size) is not int or batch_size < 1:
        raise ValueError("batch_size must be a positive integer.")
    dry_run = body.get("dry_run", False)
    if not isinstance(dry_run, bool):
        raise ValueError("dry_run must be true or false.")
    return ordered_campaigns(campaigns), min(batch_size, MAX_BATCH_SIZE), dry_run


@reminders_bp.post("/internal/reminders/run")
@require_scheduler
def run_reminders():
    body = request.get_json(silent=True) if request.get_data() else {}
    try:
        campaigns, batch_size, dry_run = _parse_body(body)
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 422
    try:
        result = run_reminder_job(campaigns, batch_size, dry_run)
    except EmailDeliveryError as exc:
        logger.warning("Reminder delivery unavailable: %s", exc.code)
        return jsonify({"error": "reminder delivery is not configured"}), 503
    except ReminderConfigError as exc:
        logger.warning("Reminder setting %s is invalid", exc)
        return jsonify({"error": "reminder settings are invalid"}), 503
    logger.info("Reminder job %s finished: %s", result["job_run_id"], result["campaigns"])
    retry = result["incomplete"] or any(
        counts.get("retryable_failed") for counts in result["campaigns"].values())
    return jsonify(result), 503 if retry else 200
