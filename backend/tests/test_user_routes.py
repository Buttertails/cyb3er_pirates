"""Tests for the signed-in user routes (GET /me, PUT /me/location).

These import main.py, so they need the Cloud Functions dependencies from
requirements.txt; without them the module is skipped. Firebase is never
contacted: token verification and the Firestore store are replaced with fakes.

Run from the backend/ directory:
    python -m pytest
"""

from __future__ import annotations

import pytest

pytest.importorskip("firebase_functions")

import firebase_admin.auth  # noqa: E402
import flask  # noqa: E402

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
    response = client.get("/me", headers=headers)
    assert response.status_code == 401
    assert "error" in response.get_json()


def test_put_location_requires_a_valid_token(client, saved):
    response = client.put("/me/location", json={"state": "TX", "zip": "78701"})
    assert response.status_code == 401
    assert saved == {}


# --------------------------------------------------------------------------- #
# Reading and saving the location
# --------------------------------------------------------------------------- #

def test_new_user_has_no_location(client):
    response = client.get("/me", headers=bearer("pat-token"))
    assert response.status_code == 200
    assert response.get_json() == {
        "uid": "user-pat",
        "email": "pat@example.com",
        "location": None,
    }


def test_saved_location_is_returned_afterwards(client, saved):
    put = client.put("/me/location", headers=bearer("pat-token"),
                     json={"state": "TX", "zip": "78701"})
    assert put.status_code == 200
    assert put.get_json()["location"] == {"state": "TX", "zip": "78701"}
    assert saved["user-pat"].email == "pat@example.com"

    got = client.get("/me", headers=bearer("pat-token"))
    assert got.get_json()["location"] == {"state": "TX", "zip": "78701"}


def test_saving_again_overwrites_the_location(client):
    client.put("/me/location", headers=bearer("pat-token"), json={"state": "TX", "zip": "78701"})
    client.put("/me/location", headers=bearer("pat-token"), json={"state": "PA", "zip": None})

    got = client.get("/me", headers=bearer("pat-token"))
    assert got.get_json()["location"] == {"state": "PA", "zip": None}


def test_each_user_has_their_own_location(client):
    client.put("/me/location", headers=bearer("pat-token"), json={"state": "TX", "zip": "78701"})

    got = client.get("/me", headers=bearer("sam-token"))
    assert got.get_json()["location"] is None


@pytest.mark.parametrize("body", [
    {"state": "XX", "zip": None},
    {"state": "TX", "zip": "123"},
    {"state": "TX", "zip": "10001"},
    {"zip": "78701"},
    {},
])
def test_invalid_location_is_rejected_and_not_saved(client, saved, body):
    response = client.put("/me/location", headers=bearer("pat-token"), json=body)
    assert response.status_code == 422
    assert response.get_json()["error"]
    assert saved == {}


def test_non_json_body_is_rejected(client, saved):
    response = client.put("/me/location", headers=bearer("pat-token"), data="state=TX")
    assert response.status_code == 422
    assert saved == {}


# --------------------------------------------------------------------------- #
# Hosting passes the /api prefix through to the function
# --------------------------------------------------------------------------- #

def call_function(path, headers=None):
    """Call the exported `api` Cloud Function the way the Functions runtime does.

    The runtime calls it inside a Flask request context, which its CORS wrapper needs.
    """
    with main.app.test_request_context(path, method="GET", headers=headers):
        return main.api(flask.request)


@pytest.mark.parametrize("path", ["/api/health", "/health"])
def test_function_serves_paths_with_and_without_api_prefix(path):
    response = call_function(path)
    assert response.status_code == 200
    assert response.get_json() == {"status": "ok"}


def test_function_routes_api_me_through_auth(saved):
    response = call_function("/api/me", headers=bearer("pat-token"))
    assert response.status_code == 200
    assert response.get_json()["uid"] == "user-pat"
