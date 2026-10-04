"""Tests for saving/listing/deleting estimates and sequence plans.

Firebase is never contacted: token verification and the saved-plan store are
replaced with fakes. Uses a real fictional employee id from the demo fixture.

Run from the backend/ directory:
    python -m pytest
"""

from __future__ import annotations

import pytest

pytest.importorskip("firebase_admin")

import firebase_admin.auth  # noqa: E402

import main  # noqa: E402
import store  # noqa: E402

TOKEN = "pat-token"
UID = "user-pat"
EMPLOYEE_ID = "demo-a-pat"  # from backend/fixtures/demo.json


def bearer():
    return {"Authorization": f"Bearer {TOKEN}"}


@pytest.fixture
def saved_store(monkeypatch):
    def fake_verify(token, *args, **kwargs):
        if token != TOKEN:
            raise firebase_admin.auth.InvalidIdTokenError("bad token")
        return {"uid": UID, "email": "pat@example.com"}

    # In-memory saved_plans: {(uid, employee_id): {id: record}}.
    records: dict = {}

    def save(uid, employee_id, record):
        row = {**record, "saved_at": "2026-10-04T00:00:00+00:00"}
        records.setdefault((uid, employee_id), {})[record["id"]] = row
        return row

    def listing(uid, employee_id):
        return list(records.get((uid, employee_id), {}).values())

    def delete(uid, employee_id, record_id):
        records.get((uid, employee_id), {}).pop(record_id, None)

    monkeypatch.setattr(firebase_admin.auth, "verify_id_token", fake_verify)
    monkeypatch.setattr(store, "save_plan_record", save)
    monkeypatch.setattr(store, "list_plan_records", listing)
    monkeypatch.setattr(store, "delete_plan_record", delete)
    return records


@pytest.fixture
def client(saved_store):
    return main.app.test_client()


def _estimate_body(record_id="est-00000001"):
    return {
        "employee_id": EMPLOYEE_ID,
        "id": record_id,
        "kind": "estimate",
        "label": "Filling",
        "result": {"lines": [{"label": "Filling", "allowed_amount": 200,
                              "plan_pays": 160, "employee_owes": 40, "covered": True}],
                   "totals": {"plan_pays": 160, "employee_owes": 40}},
    }


def test_saving_requires_a_token(client):
    response = client.post("/api/me/saved", json=_estimate_body())
    assert response.status_code == 401


def test_save_then_list_round_trips(client):
    post = client.post("/api/me/saved", headers=bearer(), json=_estimate_body())
    assert post.status_code == 200
    assert post.get_json()["saved"]["id"] == "est-00000001"
    assert post.get_json()["saved"]["saved_at"]  # server timestamp stamped

    got = client.get(f"/api/me/saved?employee_id={EMPLOYEE_ID}", headers=bearer())
    assert got.status_code == 200
    items = got.get_json()["saved"]
    assert len(items) == 1
    assert items[0]["kind"] == "estimate"
    assert items[0]["result"]["totals"]["employee_owes"] == 40


def test_save_sequence_kind(client):
    body = {
        "employee_id": EMPLOYEE_ID, "id": "seq-00000001", "kind": "sequence",
        "label": "Crown, Root canal",
        "result": {"schedule": [], "recommend_split": False,
                   "estimated_cost_recommended": 1100, "estimated_savings": 0},
    }
    assert client.post("/api/me/saved", headers=bearer(), json=body).status_code == 200
    items = client.get(f"/api/me/saved?employee_id={EMPLOYEE_ID}", headers=bearer()).get_json()["saved"]
    assert any(item["kind"] == "sequence" for item in items)


def test_save_comparison_kind(client):
    body = {
        "employee_id": EMPLOYEE_ID, "id": "cmp-00000001",
        "kind": "comparison",
        "result": {"in_network": {"totals": {"employee_owes": 40}},
                   "out_of_network": {"totals": {"employee_owes": 75}}},
    }
    assert client.post("/api/me/saved", headers=bearer(), json=body).status_code == 200
    items = client.get(f"/api/me/saved?employee_id={EMPLOYEE_ID}", headers=bearer()).get_json()["saved"]
    assert items[0]["kind"] == "comparison"


def test_delete_removes_item(client):
    client.post("/api/me/saved", headers=bearer(), json=_estimate_body("est-00000009"))
    deleted = client.delete(f"/api/me/saved/est-00000009?employee_id={EMPLOYEE_ID}", headers=bearer())
    assert deleted.status_code == 200
    items = client.get(f"/api/me/saved?employee_id={EMPLOYEE_ID}", headers=bearer()).get_json()["saved"]
    assert all(item["id"] != "est-00000009" for item in items)


@pytest.mark.parametrize("body", [
    {"employee_id": EMPLOYEE_ID, "id": "short", "kind": "estimate", "result": {}},  # id too short
    {"employee_id": EMPLOYEE_ID, "id": "ok-11111111", "kind": "nonsense", "result": {}},  # bad kind
    {"employee_id": EMPLOYEE_ID, "id": "ok-11111111", "kind": "estimate", "result": "notdict"},
    {"employee_id": "no-such-employee", "id": "ok-11111111", "kind": "estimate", "result": {}},
])
def test_invalid_saves_are_rejected(client, body):
    assert client.post("/api/me/saved", headers=bearer(), json=body).status_code == 422
