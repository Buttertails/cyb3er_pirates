"""A session reference must bind an employee without instance-local state."""

import importlib
import pytest

KEY = "test-only-signing-key-32-characters-long"


def signer(key=KEY):
    return importlib.import_module("chat_context").SessionSigner(key)


def test_reference_survives_a_different_backend_instance():
    token = signer().create("pat", "fixtures-v1", now=100)
    claims = signer().verify(token, employee_id="pat", fixture_set_id="fixtures-v1", now=101)
    assert claims.employee_id == "pat"
    assert claims.fixture_set_id == "fixtures-v1"
    assert len(claims.session_id) == 32
    assert claims.expires_at == 1900


def test_reference_binds_verified_account_and_rejects_old_context():
    token = signer().create("pat", "fixtures-v1", uid="account-a", now=100)
    assert signer().verify(token, uid="account-a", now=101).uid == "account-a"
    with pytest.raises(ValueError):
        signer().verify(token, uid="account-b", now=101)


def test_reference_expires_at_exact_boundary():
    token = signer().create("pat", "v1", now=100)
    assert signer().verify(token, now=1899)
    with pytest.raises(ValueError):
        signer().verify(token, now=1900)


@pytest.mark.parametrize("kwargs", [{"employee_id":"sam"}, {"fixture_set_id":"v2"}, {"now":99}])
def test_reference_rejects_wrong_context(kwargs):
    token = signer().create("pat", "v1", now=100)
    with pytest.raises(ValueError):
        signer().verify(token, **{"now":101, **kwargs})


@pytest.mark.parametrize("token", [None, {}, "", "invalid", "a.b.c", "!!.$$$", "x"*2049])
def test_malformed_reference_rejected(token):
    with pytest.raises(ValueError):
        signer().verify(token, now=100)


def test_modified_and_wrong_key_references_rejected():
    token = signer().create("pat", "v1", now=100)
    body, signature = token.split(".")
    for forged in ["A"+body[1:]+"."+signature, body+"."+"0"*64]:
        with pytest.raises(ValueError):
            signer().verify(forged, now=101)
    with pytest.raises(ValueError):
        signer("another-test-key-that-is-long-enough").verify(token, now=101)


def test_new_reference_gets_an_independent_cx_session():
    first = signer().verify(signer().create("pat", "v1", now=100), now=101)
    second = signer().verify(signer().create("pat", "v1", now=100), now=101)
    assert first.session_id != second.session_id


def test_configuration_requires_explicit_project_and_secrets(monkeypatch):
    module = importlib.import_module("chat_context")
    for key in module.REQUIRED_ENV:
        monkeypatch.delenv(key, raising=False)
    with pytest.raises(ValueError):
        module.ChatConfig.from_env()


def test_valid_configuration_builds_regional_session_path(monkeypatch):
    module = importlib.import_module("chat_context")
    values = {"DIALOGFLOW_PROJECT_ID":"demo-project", "DIALOGFLOW_LOCATION":"us-east1",
              "DIALOGFLOW_AGENT_ID":"demo-agent", "CHAT_SIGNING_KEY":KEY,
              "DIALOGFLOW_WEBHOOK_TOKEN":"test-only-webhook-token-32-characters-long",
              "CHAT_REFERENCE_DATE":"2026-10-03"}
    for key, value in values.items():
        monkeypatch.setenv(key, value)
    config = module.ChatConfig.from_env()
    assert config.session_path("abc") == "projects/demo-project/locations/us-east1/agents/demo-agent/sessions/abc"
    assert config.api_endpoint == "us-east1-dialogflow.googleapis.com"
    assert config.reference_date.isoformat() == "2026-10-03"
    assert KEY not in repr(config)


def test_short_signing_key_rejected():
    with pytest.raises(ValueError):
        signer("short")
