"""Real Flask/calculator behavior; no cloud or database calls."""

from copy import deepcopy
from pathlib import Path

import pytest
import main
import store
from chat_context import ChatConfig, SessionSigner

KEY = "test-only-signing-key-32-characters-long"
WEBHOOK_TOKEN = "test-only-webhook-token-32-characters-long"
AUTH = {"Authorization": f"Bearer {WEBHOOK_TOKEN}"}


@pytest.fixture
def client(monkeypatch):
    for key, value in {
        "DIALOGFLOW_PROJECT_ID": "demo-project", "DIALOGFLOW_LOCATION": "us-east1",
        "DIALOGFLOW_AGENT_ID": "demo-agent", "CHAT_SIGNING_KEY": KEY,
        "DIALOGFLOW_WEBHOOK_TOKEN": WEBHOOK_TOKEN, "CHAT_REFERENCE_DATE": "2026-10-03",
    }.items():
        monkeypatch.setenv(key, value)
    monkeypatch.delenv("CHAT_FIXTURE_PATH", raising=False)
    def forbidden_write(*args, **kwargs):
        pytest.fail("Chat must not write to Firestore.")
    for name in ("save_employer", "save_plan", "save_employee", "save_usage", "save_user_profile"):
        if hasattr(store, name):
            monkeypatch.setattr(store, name, forbidden_write)
    return main.app.test_client()


def webhook_body(employee="demo-a-pat", **parameters):
    signer = SessionSigner(KEY)
    token = signer.create(employee, "backend-chat-demo-v1")
    claims = signer.verify(token)
    return {
        "fulfillmentInfo": {"tag": "benefits.estimate"},
        "sessionInfo": {"session": ChatConfig.from_env().session_path(claims.session_id),
                        "parameters": {"backend_context": token, "procedure": "filling",
                                       "network": "in_network", **parameters}},
    }


def webhook(client, body):
    return client.post("/api/dialogflow/webhook", json=body, headers=AUTH)


def test_webhook_returns_real_estimate_and_read_only_benefits(client):
    fixture = Path(__file__).parents[1] / "fixtures/demo.json"
    before = fixture.read_bytes()
    response = webhook(client, webhook_body())
    assert response.status_code == 200
    body = response.get_json()
    payload = body["payload"]
    assert payload["estimate"]["totals"] == {"plan_pays": 160, "employee_owes": 40}
    assert payload["estimate"]["annual_max_remaining_after"] == 7090
    assert payload["benefits"]["used"] == 250
    assert payload["benefits"]["remaining"] == 7250
    assert payload["estimate"]["employee_id"] == "demo-a-pat"
    assert payload["estimate"]["assumptions"]
    text = " ".join(body["fulfillmentResponse"]["messages"][0]["text"]["text"])
    assert all(amount in text for amount in ["160.00", "40.00", "7,090.00"])
    assert body["fulfillmentResponse"]["mergeBehavior"] == "REPLACE"
    assert fixture.read_bytes() == before


@pytest.mark.parametrize("employee,procedure,want", [
    ("demo-a-sam", "filling", {"plan_pays":100, "employee_owes":100}),
    ("demo-a-pat", "root-canal", {"plan_pays":0, "employee_owes":1000}),
    ("demo-c-lee", "root-canal", {"plan_pays":500, "employee_owes":500}),
])
def test_webhook_uses_employee_usage_and_company_policy(client, employee, procedure, want):
    response = webhook(client, webhook_body(employee, procedure=procedure))
    assert response.status_code == 200
    assert response.get_json()["payload"]["estimate"]["totals"] == want


def test_out_of_network_entity_is_normalized(client):
    body = webhook(client, webhook_body(network="out-of-network")).get_json()
    assert body["payload"]["estimate"]["totals"] == {"plan_pays":174, "employee_owes":116}
    assert body["sessionInfo"]["parameters"]["network"] == "out_of_network"


def test_financial_and_employee_overrides_are_ignored(client):
    body = webhook_body(employee_id="demo-a-sam", plan_id=2, coverage_rate=1,
                        usage=[], annual_maximum=999999, plan={})
    payload = webhook(client, body).get_json()["payload"]
    assert payload["benefits"]["employee_id"] == "demo-a-pat"
    assert payload["estimate"]["totals"] == {"plan_pays":160, "employee_owes":40}


@pytest.mark.parametrize("field,value", [("procedure",None), ("procedure","unknown"),
    ("network",None), ("network","unknown"), ("network",{}),
    ("treatment_date","2026-02-30"), ("treatment_date",{"year":2026})])
def test_missing_or_invalid_choice_reprompts_without_estimate(client, field, value):
    response = webhook(client, webhook_body(**{field:value}))
    assert response.status_code == 200
    body = response.get_json()
    assert body["payload"]["status"] == "needs_input"
    assert body["payload"]["estimate"] is None
    assert body["sessionInfo"]["parameters"][field] is None


@pytest.mark.parametrize("headers", [{}, {"Authorization":"Bearer wrong"},
    {"Authorization": WEBHOOK_TOKEN}])
def test_webhook_requires_authorization(client, headers):
    response = client.post("/api/dialogflow/webhook", json=webhook_body(), headers=headers)
    assert response.status_code == 401
    assert "payload" not in response.get_json()


def test_webhook_rejects_a_signed_context_for_another_cx_session(client):
    body = webhook_body()
    body["sessionInfo"]["session"] += "different"
    assert webhook(client, body).status_code == 409


def test_webhook_rejects_context_tampering(client):
    body = webhook_body()
    body["sessionInfo"]["parameters"]["backend_context"] = "forged"
    assert webhook(client, body).status_code == 409


@pytest.mark.parametrize("body", [[], {}, {"sessionInfo": []},
    {"sessionInfo":{"parameters":[]}, "fulfillmentInfo":{"tag":"benefits.estimate"}}])
def test_malformed_webhook_returns_input_error(client, body):
    assert webhook(client, body).status_code == 422


def test_summary_returns_recorded_balance_without_estimate(client):
    body = webhook_body()
    body["fulfillmentInfo"]["tag"] = "benefits.summary"
    payload = webhook(client, body).get_json()["payload"]
    assert payload["estimate"] is None
    assert (payload["benefits"]["used"], payload["benefits"]["remaining"]) == (250,7250)


@pytest.fixture
def fake_agent(client, monkeypatch):
    """Replace only the remote boundary; real webhook/calculation still run."""
    import dialogflow_client
    sessions = {}
    def detect(config, session_id, context_token, text):
        state = sessions.setdefault(session_id, {})
        if text == "hello":
            state.clear()
            page, messages, payloads = "Procedure", ["What procedure are you planning?"], []
        elif text == "change network":
            state.pop("network", None)
            page, messages, payloads = "Network", ["Which network?"], []
        elif "procedure" not in state:
            state["procedure"] = text
            page, messages, payloads = "Network", ["Which network?"], []
        else:
            state["network"] = text
            response = webhook(client, {
                "fulfillmentInfo":{"tag":"benefits.estimate"},
                "sessionInfo":{"session":config.session_path(session_id),
                    "parameters":{"backend_context":context_token, **state}}})
            assert response.status_code == 200
            result = response.get_json()
            page = "Estimate"
            messages = result["fulfillmentResponse"]["messages"][0]["text"]["text"]
            payloads = [result["payload"]]
        return {"queryResult":{"responseMessages":[{"text":{"text":messages}}],
                                "currentPage":{"displayName":page}, "webhookPayloads":payloads,
                                "webhookStatuses":[{}]}}
    monkeypatch.setattr(dialogflow_client, "detect_intent", detect)
    return sessions


def turn(client, text=None, *, employee="demo-a-pat", session=None, event=None):
    body = {"employee_id":employee}
    if text is not None: body["text"] = text
    if session is not None: body["session_id"] = session
    if event is not None: body["event"] = event
    return client.post("/api/chat", json=body)


def test_complete_chat_and_changed_network_use_real_calculator(client, fake_agent):
    response = turn(client, event="start")
    assert response.status_code == 200
    start = response.get_json()
    session = start["session_id"]
    assert start["conversation_state"] == "Procedure"
    assert start["estimate"] is None
    assert start["conversation_mode"] == "dialogflow"
    assert start["demo_data"] is True
    assert "backend_context" not in start
    assert "demo_data" in start["benefits"]
    next_turn = turn(client, "filling", session=session).get_json()
    assert next_turn["conversation_state"] == "Network"
    assert {c["value"] for c in next_turn["choices"]} == {"in_network","out_of_network"}
    result = turn(client, "in_network", session=session).get_json()
    assert result["estimate"]["totals"] == {"plan_pays":160,"employee_owes":40}
    assert result["benefits"]["used"] == 250
    assert result["session_id"] == session
    assert "160.00" in " ".join(result["messages"])
    changed = turn(client, "change network", session=session).get_json()
    assert changed["estimate"] is None
    result = turn(client, "out_of_network", session=session).get_json()
    assert result["estimate"]["totals"] == {"plan_pays":174,"employee_owes":116}
    assert result["benefits"]["used"] == 250


def test_profile_switch_requires_a_new_session(client, fake_agent):
    session = turn(client, event="start").get_json()["session_id"]
    response = turn(client, "filling", employee="demo-c-lee", session=session)
    assert response.status_code == 409
    fresh = turn(client, event="start", employee="demo-c-lee").get_json()
    assert fresh["session_id"] != session
    assert fresh["benefits"]["plan_id"] == "C2"


def test_restart_replaces_old_or_expired_context(client, fake_agent):
    old = turn(client, event="start").get_json()["session_id"]
    result = turn(client, event="restart", session=old).get_json()
    assert result["session_id"] != old
    assert result["estimate"] is None
    assert turn(client, event="restart", session="expired-reference").status_code == 200


def test_expired_chat_context_is_rejected(client, fake_agent):
    token = SessionSigner(KEY).create("demo-a-pat", "backend-chat-demo-v1", now=1)
    assert turn(client, "filling", session=token).status_code == 409


@pytest.mark.parametrize("body", [None, [], {}, {"employee_id":{}},
    {"employee_id":"demo-a-pat","text":""},
    {"employee_id":"demo-a-pat","text":"   "},
    {"employee_id":"demo-a-pat","text":"x"*1001},
    {"employee_id":"demo-a-pat","text":123},
    {"employee_id":"demo-a-pat","text":"hello","event":"start"},
    {"employee_id":"demo-a-pat","event":"unknown"},
    {"employee_id":"demo-a-pat","text":"hello","plan_id":2},
    {"employee_id":"demo-a-pat","text":"hello","usage":[]},
    {"employee_id":"demo-a-pat","text":"hello","session_id":[]},
])
def test_invalid_chat_request_rejected_before_external_call(client, monkeypatch, body):
    import dialogflow_client
    def forbidden(*args): pytest.fail("Invalid requests must not call Dialogflow.")
    monkeypatch.setattr(dialogflow_client, "detect_intent", forbidden)
    assert client.post("/api/chat", json=body).status_code == 422


def test_unknown_employee_is_not_guessed(client, fake_agent):
    assert turn(client, "hello", employee="missing").status_code == 404


def test_missing_configuration_is_a_clear_error(client, monkeypatch):
    monkeypatch.delenv("CHAT_SIGNING_KEY")
    response = turn(client, "hello")
    assert response.status_code == 503
    assert response.get_json()["error"]["code"] == "chat_not_configured"


def test_remote_failure_returns_no_secret_or_estimate(client, monkeypatch):
    import dialogflow_client
    def broken(*args): raise TimeoutError("secret-debug-details")
    monkeypatch.setattr(dialogflow_client, "detect_intent", broken)
    response = turn(client, "hello")
    assert response.status_code == 503
    assert "secret-debug-details" not in response.get_data(as_text=True)
    assert "estimate" not in response.get_json()


def test_webhook_failure_discards_stale_financial_messages(client, monkeypatch):
    import dialogflow_client
    monkeypatch.setattr(dialogflow_client, "detect_intent", lambda *args: {
        "queryResult":{"responseMessages":[{"text":{"text":["Old estimate $999"]}}],
                        "webhookStatuses":[{"code":7}],
                        "webhookPayloads":[{"type":"dental_benefits","status":"ok","estimate":{}}]}})
    response = turn(client, "hello")
    assert response.status_code == 503
    assert "999" not in response.get_data(as_text=True)


def test_forged_payload_cannot_become_a_chat_estimate(client, monkeypatch):
    import dialogflow_client
    payload = webhook(client, webhook_body()).get_json()["payload"]
    payload["estimate"]["totals"]["plan_pays"] = 999
    monkeypatch.setattr(dialogflow_client, "detect_intent", lambda *args: {
        "queryResult":{"responseMessages":[{"text":{"text":["Fabricated $999"]}}],
                        "webhookPayloads":[payload]}})
    response = turn(client, "hello")
    assert response.status_code == 503
    assert "999" not in response.get_data(as_text=True)


def test_financial_messages_are_regenerated_from_verified_calculation(client, monkeypatch):
    import dialogflow_client
    payload = webhook(client, webhook_body()).get_json()["payload"]
    monkeypatch.setattr(dialogflow_client, "detect_intent", lambda *args: {
        "queryResult":{"responseMessages":[{"text":{"text":["Fabricated $999"]}}],
                        "webhookPayloads":[payload]}})
    response = turn(client, "hello")
    assert response.status_code == 200
    assert "999" not in " ".join(response.get_json()["messages"])
    assert "160.00" in " ".join(response.get_json()["messages"])


def test_webhook_reprompt_clears_the_current_chat_estimate(client, monkeypatch):
    import dialogflow_client
    payload = webhook(client, webhook_body(network="unknown")).get_json()["payload"]
    monkeypatch.setattr(dialogflow_client, "detect_intent", lambda *args: {
        "queryResult":{"responseMessages":[{"text":{"text":["Choose a network"]}}],
                        "webhookPayloads":[payload]}})
    response = turn(client, "hello")
    assert response.status_code == 200
    assert response.get_json()["estimate"] is None
    assert len(response.get_json()["choices"]) == 2


def test_last_webhook_reprompt_removes_earlier_financial_payload_and_text(client, monkeypatch):
    import dialogflow_client
    old = webhook(client, webhook_body()).get_json()["payload"]
    latest = webhook(client, webhook_body(network="unknown")).get_json()["payload"]
    monkeypatch.setattr(dialogflow_client, "detect_intent", lambda *args: {
        "queryResult":{"responseMessages":[{"text":{"text":["Old estimate $999", "Choose a network"]}}],
                        "webhookPayloads":[old, latest]}})
    response = turn(client, "hello")
    assert response.status_code == 200
    result = response.get_json()
    assert result["estimate"] is None
    assert "160.00" not in " ".join(result["messages"])
    assert "999" not in " ".join(result["messages"])
    assert "network" in " ".join(result["messages"]).lower()


def test_summary_chat_messages_use_current_backend_balance(client, monkeypatch):
    import dialogflow_client
    request_body = webhook_body()
    request_body["fulfillmentInfo"]["tag"] = "benefits.summary"
    payload = webhook(client, request_body).get_json()["payload"]
    monkeypatch.setattr(dialogflow_client, "detect_intent", lambda *args: {
        "queryResult":{"responseMessages":[{"text":{"text":["Remaining $999"]}}],
                        "webhookPayloads":[payload]}})
    response = turn(client, "hello")
    assert response.status_code == 200
    assert "999" not in " ".join(response.get_json()["messages"])
    assert "7,250.00" in " ".join(response.get_json()["messages"])


def test_firebase_profile_identity_and_demo_chat_coexist(client, fake_agent, monkeypatch):
    import firebase_admin.auth
    from dental.models import UserProfile
    monkeypatch.setattr(firebase_admin.auth, "verify_id_token", lambda *args, **kwargs:
                        {"uid":"firebase-user-pat", "email":"pat@example.com"})
    monkeypatch.setattr(store, "get_user_profile", lambda uid: UserProfile(uid=uid, state="NY"))
    firebase_headers = {"Authorization":"Bearer fake-firebase-id-token"}
    response = client.post("/api/chat", json={"employee_id":"demo-a-pat", "event":"start"},
                           headers=firebase_headers)
    assert response.status_code == 200
    assert response.get_json()["benefits"]["employee_id"] == "demo-a-pat"
    profile = client.get("/api/me", headers=firebase_headers)
    assert profile.status_code == 200
    assert profile.get_json()["uid"] == "firebase-user-pat"
    assert profile.get_json()["email"] == "pat@example.com"
    assert client.get("/api/me").status_code == 401
    # A Firebase login token cannot substitute for Dialogflow webhook credentials.
    assert client.post("/api/dialogflow/webhook", json=webhook_body(), headers=firebase_headers).status_code == 401
