"""Local reminder tooling: previews, emulator-only runs, and the backfill guard."""

from __future__ import annotations

import json

import pytest

import run_reminders
from dental.models import UserProfile
from tests.reminder_fakes import NOW, FakeAuthUser, MemoryReminderRepository


@pytest.fixture(autouse=True)
def no_emulator(monkeypatch):
    monkeypatch.delenv("FIRESTORE_EMULATOR_HOST", raising=False)
    monkeypatch.setattr(run_reminders, "_firestore_runtime",
                        lambda: pytest.fail("Firestore runtime loaded"))


def test_preview_renders_both_emails_and_demo_standing(capsys):
    assert run_reminders.main(["preview", "--as-of", "2026-10-04"]) == 0
    out = capsys.readouterr().out
    assert "Please review your dental profile" in out
    assert "Your dental benefits reset soon" in out
    assert "January 1, 2027" in out
    assert "?reminder=benefits" in out
    emails = out.split("Benefits standing")[0]
    assert "$" not in emails
    standing = out.split("Benefits standing")[1]
    assert "demo-a-pat: qualifies" in standing
    assert "demo-c-lee: qualifies" in standing
    assert "demo-a-sam: does not qualify" in standing


def test_preview_before_the_window_reports_no_benefits_emails(capsys):
    run_reminders.main(["preview", "--campaign", "benefits", "--as-of", "2026-09-30"])
    out = capsys.readouterr().out
    assert "demo-a-pat: does not qualify" in out


@pytest.mark.parametrize("argv", [
    ["run", "--dry-run"],
    ["run", "--sender", "log"],
    ["backfill-sign-ins"],
    ["backfill-sign-ins", "--apply"],
])
def test_firestore_commands_refuse_production_by_default(argv, capsys):
    assert run_reminders.main(argv) == 2
    assert "FIRESTORE_EMULATOR_HOST" in capsys.readouterr().err


def test_run_requires_dry_run_or_log_sender():
    with pytest.raises(SystemExit):
        run_reminders.main(["run"])
    with pytest.raises(SystemExit):
        run_reminders.main(["run", "--dry-run", "--sender", "log"])


def test_now_override_is_emulator_only(monkeypatch, capsys):
    assert run_reminders.main(["run", "--dry-run", "--allow-production", "--now", "2026-10-04T12:00:00Z"]) == 2
    assert "--now" in capsys.readouterr().err


def test_emulator_dry_run_prints_counts_only(monkeypatch, capsys):
    monkeypatch.setenv("FIRESTORE_EMULATOR_HOST", "127.0.0.1:8080")
    repo = MemoryReminderRepository([
        UserProfile(uid="pat-user", company="acme-co"),
        UserProfile(uid="sam-user", company="demo-company-3"),
    ])
    monkeypatch.setattr(run_reminders, "_firestore_runtime",
                        lambda: (repo, lambda uid: FakeAuthUser()))
    assert run_reminders.main(["run", "--dry-run", "--now", NOW.isoformat()]) == 0
    result = json.loads(capsys.readouterr().out)
    assert result["campaigns"]["benefits"]["would_send"] == 1
    assert result["campaigns"]["inactivity"]["would_send"] == 0
    assert repo.writes == 0


def test_emulator_log_sender_prints_email_and_records_delivery(monkeypatch, capsys):
    monkeypatch.setenv("FIRESTORE_EMULATOR_HOST", "127.0.0.1:8080")
    repo = MemoryReminderRepository([UserProfile(uid="pat-user", company="acme-co")])
    monkeypatch.setattr(run_reminders, "_firestore_runtime",
                        lambda: (repo, lambda uid: FakeAuthUser()))
    assert run_reminders.main(["run", "--sender", "log", "--campaign", "benefits",
                               "--now", NOW.isoformat()]) == 0
    out = capsys.readouterr().out
    assert "Your dental benefits reset soon" in out
    assert repo.deliveries[("pat-user", "benefits-2026-01-01")]["status"] == "sent"


def test_emulator_backfill_previews_unless_applied(monkeypatch, capsys):
    monkeypatch.setenv("FIRESTORE_EMULATOR_HOST", "127.0.0.1:8080")
    calls = []
    monkeypatch.setattr(run_reminders, "_backfill", lambda apply: calls.append(apply) or {
        "scanned": 2, "needs_update": 1, "updated": 1 if apply else 0})
    assert run_reminders.main(["backfill-sign-ins"]) == 0
    assert run_reminders.main(["backfill-sign-ins", "--apply"]) == 0
    assert calls == [False, True]
    assert '"needs_update": 1' in capsys.readouterr().out
