"""Tests for the Firestore client setup in store.py.

Needs the packages from requirements.txt; skipped without them. Creating a
client does not connect, so nothing is contacted.

Run from the backend/ directory:
    python -m pytest
"""

from __future__ import annotations

import pytest

pytest.importorskip("google.cloud.firestore")

import store  # noqa: E402


def test_emulator_client_needs_no_google_credentials(monkeypatch):
    # With no Application Default Credentials on the machine, the Admin SDK's
    # firestore.client() raises; under the emulator store.db() must not.
    monkeypatch.setenv("FIRESTORE_EMULATOR_HOST", "127.0.0.1:8080")
    monkeypatch.setenv("GCLOUD_PROJECT", "demo-store-test")
    monkeypatch.setenv("GOOGLE_APPLICATION_CREDENTIALS", "/nonexistent/credentials.json")
    store._emulator_client.cache_clear()

    client = store.db()

    assert client.project == "demo-store-test"
    assert store.db() is client
    store._emulator_client.cache_clear()
