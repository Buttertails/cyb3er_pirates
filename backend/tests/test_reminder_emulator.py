"""End-to-end reminder run against the Firebase emulators (opt-in).

Runs only when both emulator hosts are set and the project id starts with
``demo-`` (so it can never touch a real project). It wipes that emulator
project, seeds users, and runs the real Firestore repository with a fake sender:

    firebase emulators:start --only firestore,auth --project demo-reminders
    FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099 \\
    GOOGLE_CLOUD_PROJECT=demo-reminders venv/bin/python -m pytest tests/test_reminder_emulator.py
"""

from __future__ import annotations

import os
from datetime import timedelta
from urllib.request import Request, urlopen

import pytest

PROJECT = os.environ.get("GOOGLE_CLOUD_PROJECT", "")
pytestmark = pytest.mark.skipif(
    not (os.environ.get("FIRESTORE_EMULATOR_HOST") and os.environ.get("FIREBASE_AUTH_EMULATOR_HOST")
         and PROJECT.startswith("demo-")),
    reason="needs the Firestore and Auth emulators with a demo- project")


def _wipe():
    for host, path in ((os.environ["FIRESTORE_EMULATOR_HOST"],
                        f"/emulator/v1/projects/{PROJECT}/databases/(default)/documents"),
                       (os.environ["FIREBASE_AUTH_EMULATOR_HOST"], f"/emulator/v1/projects/{PROJECT}/accounts")):
        urlopen(Request(f"http://{host}{path}", method="DELETE"), timeout=5).close()


@pytest.fixture
def seeded():
    import main  # noqa: F401 - initializes the Admin SDK for the emulators
    from firebase_admin import auth as firebase_auth

    import store
    from tests.reminder_fakes import NOW

    _wipe()
    users = {
        "almost": {"last_sign_in_at": NOW - timedelta(days=90) + timedelta(seconds=1)},
        "exact": {"last_sign_in_at": NOW - timedelta(days=90)},
        "already": {"last_sign_in_at": NOW - timedelta(days=120)},
        "unverified": {"last_sign_in_at": NOW - timedelta(days=120)},
        "disabled": {"last_sign_in_at": NOW - timedelta(days=120)},
        "pat": {"company": "acme-co", "last_sign_in_at": NOW - timedelta(days=1)},
        "lee": {"company": "demo-company-2", "last_sign_in_at": NOW - timedelta(days=1)},
        "sam": {"company": "demo-company-3", "last_sign_in_at": NOW - timedelta(days=1)},
    }
    client = store.db()
    for uid, data in users.items():
        client.collection("users").document(uid).set({**data, "inactivity_cycle_id": f"cycle-{uid}"})
        firebase_auth.create_user(uid=uid, email=f"{uid}@example.com",
                                  email_verified=uid != "unverified", disabled=uid == "disabled")
    (client.collection("users").document("already").collection("reminder_deliveries")
     .document("inactivity-cycle-already").set({"status": "sent"}))
    yield
    _wipe()


def test_full_run_against_the_emulators(seeded):
    import reminder_routes
    import reminders
    import store
    from tests.reminder_fakes import NOW, FakeClock, FakeEmailSender

    sender = FakeEmailSender()
    runner = reminders.ReminderRunner(store.FirestoreReminderRepository(), reminder_routes.auth_lookup,
                                      sender, FakeClock(NOW), sign_in_url="https://app.example.com/")
    campaigns = reminder_routes.build_campaigns(["inactivity", "benefits"])

    first = runner.run(campaigns)
    inactivity, benefits = first["campaigns"]["inactivity"], first["campaigns"]["benefits"]
    assert inactivity["sent"] == 1  # "exact"; "almost" is one second short
    assert inactivity["already_terminal"] == 1
    assert inactivity["skipped_auth"] == 2
    assert benefits["sent"] == 2  # pat and lee; sam has used most of the maximum
    assert sorted(call["to"] for call in sender.calls) == [
        "exact@example.com", "lee@example.com", "pat@example.com"]

    second = runner.run(campaigns)
    assert second["campaigns"]["inactivity"]["sent"] == 0
    assert second["campaigns"]["benefits"]["sent"] == 0
    assert len(sender.calls) == 3

    sent = (store.db().collection("users").document("pat").collection("reminder_deliveries")
            .document("benefits-2026-01-01").get().to_dict())
    assert sent["status"] == "sent" and sent["attempt_count"] == 1
    assert "pat@example.com" not in repr(sent)
