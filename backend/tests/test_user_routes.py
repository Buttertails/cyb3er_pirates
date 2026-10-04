"""Tests for the signed-in user routes (GET /api/me, PUT /api/me/location).

These import main.py (the standalone Flask server), so they need firebase-admin
and flask from requirements.txt; without them the module is skipped. Firebase is
never contacted: token verification and the Firestore store are replaced with
fakes.

Run from the backend/ directory:
    python -m pytest
"""

from __future__ import annotations

import pytest

pytest.importorskip("firebase_admin")

import firebase_admin.auth  # noqa: E402

import main  # noqa: E402
import store  # noqa: E402

TOKENS = {
    "pat-token": {"uid": "user-pat", "email": "pat@example.com"},
    "sam-token": {"uid": "user-sam", "email": "sam@example.com"},
}


def bearer(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def saved(monkeypatch):
    """Fake token verification and an in-memory users/{uid} store."""

    def fake_verify(token, *args, **kwargs):
        if token not in TOKENS:
            raise firebase_admin.auth.InvalidIdTokenError("bad token")
        return TOKENS[token]

    profiles = {}
    monkeypatch.setattr(firebase_admin.auth, "verify_id_token", fake_verify)
    monkeypatch.setattr(store, "get_user_profile", lambda uid: profiles.get(uid))
    monkeypatch.setattr(store, "save_user_profile", lambda p: profiles.__setitem__(p.uid, p))
    def patch(uid, fields):
        data = profiles[uid].to_dict() if uid in profiles else {"uid": uid}
        data.update(fields)
        profiles[uid] = main.UserProfile.from_dict(data)
    monkeypatch.setattr(store, "patch_user_profile", patch)
    return profiles


@pytest.fixture
def client(saved):
    return main.app.test_client()


# --------------------------------------------------------------------------- #
# Sign-in is required
# --------------------------------------------------------------------------- #

@pytest.mark.parametrize("headers", [
    {},
    {"Authorization": "pat-token"},
    {"Authorization": "Bearer "},
    bearer("not-a-real-token"),
])
def test_me_requires_a_valid_token(client, headers):
    response = client.get("/api/me", headers=headers)
    assert response.status_code == 401
    assert "error" in response.get_json()


def test_put_location_requires_a_valid_token(client, saved):
    response = client.put("/api/me/location", json={"state": "TX", "zip": "78701"})
    assert response.status_code == 401
    assert saved == {}


# --------------------------------------------------------------------------- #
# Reading and saving the location
# --------------------------------------------------------------------------- #

def test_new_user_has_no_location(client):
    response = client.get("/api/me", headers=bearer("pat-token"))
    assert response.status_code == 200
    assert response.get_json() == {
        "uid": "user-pat",
        "email": "pat@example.com",
        "location": None,
        "name": None,
        "company": None,
        "office": None,
        "last_sign_in_at": None,
    }


def test_saved_location_is_returned_afterwards(client, saved):
    put = client.put("/api/me/location", headers=bearer("pat-token"),
                     json={"state": "TX", "zip": "78701"})
    assert put.status_code == 200
    assert put.get_json()["location"] == {"state": "TX", "zip": "78701"}
    assert saved["user-pat"].email == "pat@example.com"

    got = client.get("/api/me", headers=bearer("pat-token"))
    assert got.get_json()["location"] == {"state": "TX", "zip": "78701"}


def test_saving_again_overwrites_the_location(client):
    client.put("/api/me/location", headers=bearer("pat-token"), json={"state": "TX", "zip": "78701"})
    client.put("/api/me/location", headers=bearer("pat-token"), json={"state": "PA", "zip": None})

    got = client.get("/api/me", headers=bearer("pat-token"))
    assert got.get_json()["location"] == {"state": "PA", "zip": None}


def test_each_user_has_their_own_location(client):
    client.put("/api/me/location", headers=bearer("pat-token"), json={"state": "TX", "zip": "78701"})

    got = client.get("/api/me", headers=bearer("sam-token"))
    assert got.get_json()["location"] is None


def test_profile_fields_survive_location_update_and_are_account_scoped(client):
    saved = client.patch("/api/me", headers=bearer("pat-token"),
                         json={"name": "Pat", "company": "Acme", "office": "Main"})
    assert saved.status_code == 200
    changed = client.put("/api/me/location", headers=bearer("pat-token"),
                         json={"state": "TX", "zip": "78701"})
    assert changed.status_code == 200
    profile = client.get("/api/me", headers=bearer("pat-token")).get_json()
    assert (profile["name"], profile["company"], profile["office"]) == ("Pat", "Acme", "Main")
    assert profile["location"] == {"state": "TX", "zip": "78701"}
    other = client.get("/api/me", headers=bearer("sam-token")).get_json()
    assert other["name"] is None


def test_profile_rejects_unapproved_fields(client):
    response = client.patch("/api/me", headers=bearer("pat-token"),
                            json={"uid": "someone-else", "name": "Pat"})
    assert response.status_code == 422


def test_profile_saves_only_submitted_fields(client, monkeypatch):
    writes = []
    def record(uid, fields):
        writes.append((uid, fields))
    monkeypatch.setattr(store, "patch_user_profile", record, raising=False)
    client.patch("/api/me", headers=bearer("pat-token"), json={"name": "Pat"})
    client.put("/api/me/location", headers=bearer("pat-token"),
               json={"state": "TX", "zip": "78701"})
    assert writes == [
        ("user-pat", {"email": "pat@example.com", "name": "Pat"}),
        ("user-pat", {"email": "pat@example.com", "state": "TX", "zip": "78701"}),
    ]


def test_sign_in_updates_marker_without_erasing_profile(client):
    client.patch("/api/me", headers=bearer("pat-token"), json={"name": "Pat"})
    response = client.post("/api/me/sign-in", headers=bearer("pat-token"), json={})
    assert response.status_code == 200
    assert response.get_json()["last_sign_in_at"]
    assert response.get_json()["name"] == "Pat"


def test_completed_care_is_scoped_and_retry_does_not_double_count(client, monkeypatch):
    reports = {}
    monkeypatch.setattr(store, "list_care_reports",
                        lambda uid, eid: list(reports.get((uid, eid), {}).values()))
    def commit(uid, eid, batch, seed, maximum):
        records = reports.setdefault((uid, eid), {})
        for report in batch:
            prior = records.get(report["submission_id"])
            if prior is not None and any(prior[k] != v for k, v in report.items()):
                raise store.CareConflict("conflict")
        for report in batch:
            records.setdefault(report["submission_id"], report)
        return [records[report["submission_id"]] for report in batch]
    monkeypatch.setattr(store, "commit_care_batch", commit)
    body = {"employee_id": "demo-a-pat", "procedures": [{
        "submission_id": "care-123", "procedure": "filling", "category": "general",
        "date": "2026-09", "cost": 200, "you_paid": 40, "insurance_paid": 160
    }]}
    first = client.post("/api/me/procedures", headers=bearer("pat-token"), json=body)
    assert first.status_code == 200
    second = client.post("/api/me/procedures", headers=bearer("pat-token"), json=body)
    assert second.status_code == 200
    assert len(reports[("user-pat", "demo-a-pat")]) == 1
    own = client.get("/api/me/procedures?employee_id=demo-a-pat",
                     headers=bearer("pat-token")).get_json()
    other = client.get("/api/me/procedures?employee_id=demo-a-pat",
                       headers=bearer("sam-token")).get_json()
    assert len(own["procedures"]) == 1
    assert other["procedures"] == []


def test_completed_care_rejects_payment_above_remaining_allowance(client, monkeypatch):
    def reject(uid, eid, reports, seed, maximum):
        assert seed["2026-01-01"] == 740000
        assert maximum == 750000
        raise ValueError("Annual allowance exceeded.")
    monkeypatch.setattr(store, "commit_care_batch", reject)
    response = client.post("/api/me/procedures", headers=bearer("pat-token"), json={
        "employee_id": "demo-a-sam", "procedures": [{
            "submission_id": "care-126", "procedure": "filling", "category": "general",
            "date": "2026-09", "cost": 200, "you_paid": 0, "insurance_paid": 200,
        }],
    })
    assert response.status_code == 422


def test_selected_employee_benefits_and_estimate_use_confirmed_account_usage(client, monkeypatch):
    report = {"submission_id": "care-lee1", "employee_id": "demo-c-lee",
              "procedure": "filling", "category": "general", "date": "2026-09-01",
              "cost_cents": 20000, "you_paid_cents": 10000, "insurance_paid_cents": 10000}
    monkeypatch.setattr(store, "list_care_reports",
                        lambda uid, eid: [report] if (uid, eid) == ("user-pat", "demo-c-lee") else [])
    benefits = client.get("/api/me/benefits?employee_id=demo-c-lee",
                          headers=bearer("pat-token"))
    assert benefits.status_code == 200
    assert benefits.get_json()["benefits"]["used"] == 600
    other = client.get("/api/me/benefits?employee_id=demo-c-lee",
                       headers=bearer("sam-token"))
    assert other.get_json()["benefits"]["used"] == 500
    estimate = client.post("/api/me/estimate", headers=bearer("pat-token"),
                           json={"employee_id": "demo-c-lee", "procedure_id": "root-canal",
                                 "network": "in_network", "as_of": "2026-10-03"})
    assert estimate.status_code == 200
    assert estimate.get_json()["estimate"]["plan_id"] == "C2"
    assert estimate.get_json()["estimate"]["annual_max_used_before"] == 600


def test_selected_employee_estimate_rejects_malformed_date(client, monkeypatch):
    monkeypatch.setattr(store, "list_care_reports", lambda uid, eid: [])
    response = client.post("/api/me/estimate", headers=bearer("pat-token"),
                           json={"employee_id": "demo-a-pat", "procedure_id": "filling",
                                 "as_of": {"date": "2026-10-03"}})
    assert response.status_code == 422


@pytest.mark.parametrize("body", [
    {"state": "XX", "zip": None},
    {"state": "TX", "zip": "123"},
    {"state": "TX", "zip": "10001"},
    {"zip": "78701"},
    {},
])
def test_invalid_location_is_rejected_and_not_saved(client, saved, body):
    response = client.put("/api/me/location", headers=bearer("pat-token"), json=body)
    assert response.status_code == 422
    assert response.get_json()["error"]
    assert saved == {}


def test_non_json_body_is_rejected(client, saved):
    response = client.put("/api/me/location", headers=bearer("pat-token"), data="state=TX")
    assert response.status_code == 422
    assert saved == {}


# --------------------------------------------------------------------------- #
# The server serves API routes under /api and the static frontend elsewhere
# --------------------------------------------------------------------------- #

def test_health_is_served_under_api_prefix(client):
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.get_json() == {"status": "ok"}


def test_api_me_routes_through_auth(client, saved):
    response = client.get("/api/me", headers=bearer("pat-token"))
    assert response.status_code == 200
    assert response.get_json()["uid"] == "user-pat"
