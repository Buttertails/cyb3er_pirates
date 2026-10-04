"""Local tooling for the reminder emails. Never sends real email.

    python run_reminders.py preview [--campaign all|inactivity|benefits] [--as-of YYYY-MM-DD]
    python run_reminders.py run (--dry-run | --sender log) [--campaign ...] [--batch-size N] [--now ISO]
    python run_reminders.py backfill-sign-ins [--apply]

``preview`` touches no data. ``run`` and ``backfill-sign-ins`` read Firestore and
refuse to start unless FIRESTORE_EMULATOR_HOST is set: the repo-root admin key
would otherwise point them at production. ``--allow-production`` overrides that
deliberately; ``--now`` is emulator-only. Real sends happen only through the
deployed ``POST /api/internal/reminders/run``.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from datetime import date, datetime, timezone

from chat_profiles import load_profiles
from email_delivery import LoggingEmailSender, benefits_email, inactivity_email
from reminder_campaigns import benefits_standing, qualifies_for_benefits_reminder
from reminders import CAMPAIGN_ORDER, MAX_BATCH_SIZE, ReminderRunner

DEFAULT_SIGN_IN_URL = "https://cyb3r-pirates.web.app/index.html"
DEMO_EMPLOYEES = ("demo-a-pat", "demo-c-lee", "demo-a-sam")


def _campaign_names(value: str) -> list[str]:
    return list(CAMPAIGN_ORDER) if value == "all" else [value]


def _parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    commands = parser.add_subparsers(dest="command", required=True)
    campaign = {"choices": ["all", *CAMPAIGN_ORDER], "default": "all"}

    preview = commands.add_parser("preview", help="Render both emails and the demo benefits standing.")
    preview.add_argument("--campaign", **campaign)
    preview.add_argument("--as-of", type=date.fromisoformat, default=date.today())
    preview.add_argument("--sign-in-url", default=os.environ.get("APP_SIGN_IN_URL") or DEFAULT_SIGN_IN_URL)

    run = commands.add_parser("run", help="Run the job against Firestore without real email.")
    mode = run.add_mutually_exclusive_group(required=True)
    mode.add_argument("--dry-run", action="store_true", help="Count only; write nothing.")
    mode.add_argument("--sender", choices=["log"], help="Print emails instead of sending them.")
    run.add_argument("--campaign", **campaign)
    run.add_argument("--batch-size", type=int, default=MAX_BATCH_SIZE)
    run.add_argument("--now", type=lambda v: datetime.fromisoformat(v.replace("Z", "+00:00")))
    run.add_argument("--sign-in-url", default=os.environ.get("APP_SIGN_IN_URL") or DEFAULT_SIGN_IN_URL)
    run.add_argument("--allow-production", action="store_true")

    backfill = commands.add_parser("backfill-sign-ins", help="Convert legacy string sign-in times.")
    backfill.add_argument("--apply", action="store_true", help="Write changes (default: preview).")
    backfill.add_argument("--allow-production", action="store_true")
    return parser


def _preview(args) -> int:
    names = _campaign_names(args.campaign)
    profiles = load_profiles(os.environ.get("CHAT_FIXTURE_PATH"))
    if "inactivity" in names:
        message = inactivity_email(args.sign_in_url)
        print(f"=== inactivity ===\nSubject: {message.subject}\n\n{message.text}\n")
    if "benefits" in names:
        standing = benefits_standing(profiles.employee(DEMO_EMPLOYEES[0]), [], args.as_of)
        message = benefits_email(args.sign_in_url, plan_year_label=standing.plan_year_label,
                                 resets_on=standing.resets_on)
        print(f"=== benefits ===\nSubject: {message.subject}\n\n{message.text}\n")
        print(f"Benefits standing on {args.as_of.isoformat()} (fixture usage only, "
              f"window opens {standing.window_opens_on.isoformat()}):")
        for employee_id in DEMO_EMPLOYEES:
            standing = benefits_standing(profiles.employee(employee_id), [], args.as_of)
            left = 100 * (standing.annual_maximum_cents - standing.used_cents) / standing.annual_maximum_cents
            verdict = ("qualifies" if qualifies_for_benefits_reminder(standing, args.as_of)
                       else "does not qualify")
            print(f"  {employee_id}: {verdict} ({left:.1f}% of the annual maximum left)")
    return 0


def _guard(args) -> str | None:
    emulator = bool(os.environ.get("FIRESTORE_EMULATOR_HOST"))
    if not emulator and not args.allow_production:
        return ("Refusing to touch production Firestore: set FIRESTORE_EMULATOR_HOST "
                "(and FIREBASE_AUTH_EMULATOR_HOST) or pass --allow-production.")
    if getattr(args, "now", None) is not None and not emulator:
        return "--now is only allowed against the Firestore emulator."
    return None


def _firestore_runtime():
    """Initialize Firebase (via main) only after the production guard passed."""
    import main  # noqa: F401 - initializes the Admin SDK for the emulators or the key
    import reminder_routes
    import store
    return store.FirestoreReminderRepository(), reminder_routes.auth_lookup


def _backfill(apply: bool) -> dict:
    import main  # noqa: F401
    import store
    return store.backfill_sign_ins(apply=apply)


def _run(args) -> int:
    import reminder_routes
    repository, lookup = _firestore_runtime()
    now = args.now.astimezone(timezone.utc) if args.now else datetime.now(timezone.utc)
    sender = LoggingEmailSender(args.sign_in_url) if args.sender == "log" else None
    runner = ReminderRunner(repository, lookup, sender, clock=lambda: now,
                            sign_in_url=args.sign_in_url,
                            allow_unverified=reminder_routes.env_flag("REMINDER_ALLOW_UNVERIFIED"))
    result = runner.run(reminder_routes.build_campaigns(_campaign_names(args.campaign)),
                        batch_size=args.batch_size, dry_run=args.dry_run)
    print(json.dumps(result, indent=2))
    return 0


def main(argv: list[str] | None = None) -> int:
    args = _parser().parse_args(argv)
    if args.command == "preview":
        return _preview(args)
    problem = _guard(args)
    if problem:
        print(problem, file=sys.stderr)
        return 2
    if args.command == "run":
        return _run(args)
    print(json.dumps(_backfill(args.apply), indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())
