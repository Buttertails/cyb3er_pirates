"""POST /api/internal/reminders/run: scheduler identity, validation, redaction."""

from __future__ import annotations

import pytest

pytest.importorskip("firebase_admin")

import auth  # noqa: E402
import main  # noqa: E402
import reminder_routes  # noqa: E402

URL = "/api/internal/reminders/run"
SCHEDULER = "scheduler@example.iam.gserviceaccount.com"
OIDC = {"Authorization": "Bearer oidc-token"}


def counts(**overrides):
    base = {"candidates": 0, "sent": 0, "would_send": 0, "already_terminal": 0, "leased": 0,
            "skipped_auth": 0, "stale": 0, "retryable_failed": 0, "permanent_failed": 0,
            "incomplete": False}
    return {**base, **overrides}


@pytest.fixture
def calls(monkeypatch):
    monkeypatch.setenv("REMINDER_JOB_AUDIENCE", "https://service.example.com")
    monkeypatch.setenv("REMINDER_JOB_SERVICE_ACCOUNT", SCHEDULER)
    monkeypatch.setattr(auth, "verify_google_id_token", lambda token, audience: {
        "email": SCHEDULER, "email_verified": True} if (token, audience) == (
            "oidc-token", "https://service.example.com") else (_ for _ in ()).throw(ValueError("bad")))
    seen = []

    def fake_job(campaigns, batch_size, dry_run):
        seen.append((campaigns, batch_size, dry_run))
        return {"job_run_id": "job-1", "dry_run": dry_run, "incomplete": False,
                "campaigns": {name: counts(sent=1) for name in campaigns}}

    monkeypatch.setattr(reminder_routes, "run_reminder_job", fake_job)
    return seen


@pytest.fixture
def client(calls):
    return main.app.test_client()


# --------------------------------------------------------------------------- #
# Scheduler identity
# --------------------------------------------------------------------------- #

def test_missing_token_is_rejected(client, calls):
    assert client.post(URL, json={}).status_code == 401
    assert calls == []


def test_invalid_token_is_rejected(client, calls):
    response = client.post(URL, json={}, headers={"Authorization": "Bearer forged"})
    assert response.status_code == 401
    assert calls == []


@pytest.mark.parametrize("claims", [
    {"email": "other@example.iam.gserviceaccount.com", "email_verified": True},
    {"email": SCHEDULER, "email_verified": False},
    {"email": SCHEDULER},
])
def test_other_or_unverified_identity_is_forbidden(client, calls, monkeypatch, claims):
    monkeypatch.setattr(auth, "verify_google_id_token", lambda token, audience: claims)
    assert client.post(URL, json={}, headers=OIDC).status_code == 403
    assert calls == []


@pytest.mark.parametrize("missing", ["REMINDER_JOB_AUDIENCE", "REMINDER_JOB_SERVICE_ACCOUNT"])
def test_unconfigured_scheduler_returns_503(client, calls, monkeypatch, missing):
    monkeypatch.delenv(missing)
    assert client.post(URL, json={}, headers=OIDC).status_code == 503
    assert calls == []


def test_firebase_user_tokens_are_not_accepted(client, calls, monkeypatch):
    import firebase_admin.auth
    monkeypatch.setattr(firebase_admin.auth, "verify_id_token", lambda token: {"uid": "u"})
    monkeypatch.setattr(auth, "verify_google_id_token",
                        lambda token, audience: (_ for _ in ()).throw(ValueError("wrong issuer")))
    assert client.post(URL, json={}, headers=OIDC).status_code == 401


# --------------------------------------------------------------------------- #
# Body validation
# --------------------------------------------------------------------------- #

def test_defaults_run_both_campaigns_in_order(client, calls):
    response = client.post(URL, headers=OIDC)
    assert response.status_code == 200
    assert calls == [(["inactivity", "benefits"], 25, False)]


def test_options_are_passed_through_in_fixed_order(client, calls):
    response = client.post(URL, headers=OIDC, json={
        "campaigns": ["benefits", "inactivity"], "batch_size": 999, "dry_run": True})
    assert response.status_code == 200
    assert calls == [(["inactivity", "benefits"], 25, True)]


@pytest.mark.parametrize("body", [
    [], "run", {"unknown": 1}, {"campaigns": []}, {"campaigns": "benefits"},
    {"campaigns": ["marketing"]}, {"campaigns": ["benefits", "benefits"]},
    {"batch_size": 0}, {"batch_size": "5"}, {"batch_size": True}, {"batch_size": 2.5},
    {"dry_run": "yes"}, {"dry_run": 1},
])
def test_invalid_bodies_are_rejected(client, calls, body):
    assert client.post(URL, headers=OIDC, json=body).status_code == 422
    assert calls == []


# --------------------------------------------------------------------------- #
# Results
# --------------------------------------------------------------------------- #

def test_response_contains_redacted_counts_only(client, calls):
    response = client.post(URL, headers=OIDC, json={"campaigns": ["benefits"]})
    assert response.status_code == 200
    data = response.get_json()
    assert data["campaigns"]["benefits"]["sent"] == 1
    text = response.get_data(as_text=True)
    assert "@" not in text and "uid" not in text and "reminder/" not in text


@pytest.mark.parametrize("result", [
    {"job_run_id": "j", "dry_run": False, "incomplete": False,
     "campaigns": {"inactivity": counts(retryable_failed=1)}},
    {"job_run_id": "j", "dry_run": False, "incomplete": True,
     "campaigns": {"inactivity": counts(incomplete=True)}},
])
def test_retryable_or_incomplete_runs_return_503(client, monkeypatch, result):
    monkeypatch.setattr(reminder_routes, "run_reminder_job", lambda *a: result)
    assert client.post(URL, headers=OIDC, json={}).status_code == 503


def test_unconfigured_delivery_returns_503_before_touching_data(client, monkeypatch):
    for name in ("RESEND_API_KEY", "REMINDER_FROM_EMAIL", "APP_SIGN_IN_URL"):
        monkeypatch.delenv(name, raising=False)
    monkeypatch.setattr(reminder_routes, "run_reminder_job", reminder_routes._run_reminder_job)

    def no_firestore():
        raise AssertionError("Firestore touched without delivery configuration")

    monkeypatch.setattr(reminder_routes.store, "FirestoreReminderRepository", no_firestore)
    response = client.post(URL, headers=OIDC, json={})
    assert response.status_code == 503
    assert "RESEND" not in response.get_data(as_text=True)


@pytest.mark.parametrize("name,value", [
    ("REMINDER_BENEFITS_LEAD_MONTHS", "0"),
    ("REMINDER_BENEFITS_LEAD_MONTHS", "twelve"),
    ("REMINDER_BENEFITS_REMAINING_PERCENT", "101"),
])
def test_invalid_benefits_settings_return_503(client, monkeypatch, name, value):
    monkeypatch.setenv(name, value)
    monkeypatch.setattr(reminder_routes, "run_reminder_job", reminder_routes._run_reminder_job)
    monkeypatch.setattr(reminder_routes.store, "FirestoreReminderRepository",
                        lambda: pytest.fail("Firestore touched with invalid settings"))
    response = client.post(URL, headers=OIDC, json={"dry_run": True})
    assert response.status_code == 503


def test_get_is_a_json_404(client):
    response = client.get(URL)
    assert response.status_code == 404
    assert response.is_json


def test_legacy_end_of_year_route_is_unchanged(client):
    response = client.post("/api/reminders", json={"plan_id": "C0", "as_of": "2026-10-04"})
    assert response.status_code == 200
    assert "within_reminder_window" in response.get_json()
