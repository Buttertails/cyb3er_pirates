"""Test the in/out-of-network comparison route (POST /api/me/compare).

Firebase is faked; uses a real fictional employee from the demo fixture.

Run from the backend/ directory:
    python -m pytest
"""

from __future__ import annotations

import pytest

pytest.importorskip("firebase_admin")

import firebase_admin.auth  # noqa: E402

import main  # noqa: E402

TOKEN = "pat-token"
EMPLOYEE_ID = "demo-c-lee"  # plan C2 covers major, so networks differ


@pytest.fixture
def client(monkeypatch):
    def fake_verify(token, *args, **kwargs):
        if token != TOKEN:
            raise firebase_admin.auth.InvalidIdTokenError("bad token")
        return {"uid": "user-pat", "email": "pat@example.com"}

    monkeypatch.setattr(firebase_admin.auth, "verify_id_token", fake_verify)
    # No stored confirmed care for this user/employee.
    import store
    monkeypatch.setattr(store, "list_care_reports", lambda uid, emp: [])
    return main.app.test_client()


def bearer():
    return {"Authorization": f"Bearer {TOKEN}"}


def test_compare_requires_a_token(client):
    response = client.post("/api/me/compare", json={"employee_id": EMPLOYEE_ID, "procedure_id": "root-canal"})
    assert response.status_code == 401


def test_compare_returns_both_networks_and_savings(client):
    response = client.post("/api/me/compare", headers=bearer(),
                           json={"employee_id": EMPLOYEE_ID, "procedure_id": "root-canal"})
    assert response.status_code == 200
    comparison = response.get_json()["comparison"]
    assert "in_network" in comparison and "out_of_network" in comparison
    in_owes = comparison["in_network"]["totals"]["employee_owes"]
    out_owes = comparison["out_of_network"]["totals"]["employee_owes"]
    # Out-of-network should cost the member at least as much as in-network.
    assert out_owes >= in_owes
    assert comparison["employee_savings_in_network"] == round(out_owes - in_owes, 2)
    assert isinstance(comparison["recommendation"], str)


@pytest.mark.parametrize("body", [
    {"employee_id": EMPLOYEE_ID, "procedure_id": "not-a-procedure"},
    {"employee_id": "no-such-employee", "procedure_id": "root-canal"},
    {"procedure_id": "root-canal"},
])
def test_compare_rejects_bad_input(client, body):
    assert client.post("/api/me/compare", headers=bearer(), json=body).status_code == 422
