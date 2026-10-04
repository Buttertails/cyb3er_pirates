"""SDK boundary tests inspect actual protobuf requests, without Google calls."""

import importlib
from datetime import date

import pytest
from google.cloud import dialogflowcx_v3 as cx
from google.rpc.status_pb2 import Status
from chat_context import ChatConfig


def config(location="us-east1"):
    return ChatConfig("demo-project", location, "demo-agent", "k"*32, "w"*32,
                      reference_date=date(2026,10,3))


def test_sdk_request_binds_session_and_context_without_automatic_retries(monkeypatch):
    module = importlib.import_module("dialogflow_client")
    observed = {}
    response = cx.DetectIntentResponse(query_result=cx.QueryResult(
        response_messages=[cx.ResponseMessage(text=cx.ResponseMessage.Text(text=["Which procedure?"]))],
        current_page=cx.Page(display_name="Procedure"), webhook_statuses=[Status(code=0)]))
    class FakeClient:
        def __init__(self, **kwargs): observed.update(kwargs)
        def __enter__(self): return self
        def __exit__(self, *args): pass
        def detect_intent(self, **kwargs):
            observed.update(kwargs)
            return response
    monkeypatch.setattr(cx, "SessionsClient", FakeClient)
    result = module.detect_intent(config(), "session123", "signed-reference", "hello")
    request = observed["request"]
    assert isinstance(request, cx.DetectIntentRequest)
    assert request.session == "projects/demo-project/locations/us-east1/agents/demo-agent/sessions/session123"
    assert request.query_input.text.text == "hello"
    assert request.query_input.language_code == "en"
    assert request.query_params.parameters["backend_context"] == "signed-reference"
    assert observed["client_options"]["api_endpoint"] == "us-east1-dialogflow.googleapis.com"
    assert observed["retry"] is None
    assert observed["timeout"] == 15
    assert result["queryResult"]["responseMessages"] == [{"text":{"text":["Which procedure?"]}}]
    assert result["queryResult"]["currentPage"]["displayName"] == "Procedure"


def test_sdk_propagates_failures_for_route_to_handle(monkeypatch):
    module = importlib.import_module("dialogflow_client")
    class FailingClient:
        def __init__(self, **kwargs): pass
        def __enter__(self): return self
        def __exit__(self, *args): pass
        def detect_intent(self, **kwargs): raise TimeoutError("fake SDK timeout")
    monkeypatch.setattr(cx, "SessionsClient", FailingClient)
    with pytest.raises(TimeoutError):
        module.detect_intent(config(), "session123", "signed-reference", "hello")


def test_clear_directory_requests_use_cx_event_even_during_form_filling(monkeypatch):
    module = importlib.import_module("dialogflow_client")
    requests = []
    class FakeClient:
        def __init__(self, **kwargs): pass
        def __enter__(self): return self
        def __exit__(self, *args): pass
        def detect_intent(self, **kwargs):
            requests.append(kwargs["request"])
            return cx.DetectIntentResponse()
    monkeypatch.setattr(cx, "SessionsClient", FakeClient)

    for phrase in ("find in-network dentists near me", "show nearby dentists",
                   "which dentists take my plan"):
        module.detect_intent(config(), "session123", "signed-reference", phrase)
    module.detect_intent(config(), "session123", "signed-reference",
                         "should I use an in-network dentist for my crown?")

    assert [request.query_input.event.event for request in requests[:3]] == ["dentists.find"] * 3
    assert requests[3].query_input.text.text == "should I use an in-network dentist for my crown?"
