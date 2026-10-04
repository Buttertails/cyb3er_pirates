"""Flask chat adapters around the team's existing deterministic calculator."""

from __future__ import annotations

import hmac
from dataclasses import replace
from functools import wraps

from flask import Blueprint, current_app, g, jsonify, request

from auth import require_user
from chat_context import ChatConfig, SessionSigner
from chat_profiles import iso_date, load_profiles
from completed_care import report_usage
from dental import catalog, engine
from dental.models import Network
import dialogflow_client
import store

chat = Blueprint("chat", __name__)

NETWORK_CHOICES = [{"label": "In network", "value": "in_network"},
                   {"label": "Out of network", "value": "out_of_network"}]
ASSUMPTIONS = ["Illustrative prices and prior usage; this is an approximate estimate.",
               "Coverage percentages use assumed category rates for this policy.",
               "An estimate does not record completed care or change benefits usage."]


class ChatProblem(Exception):
    def __init__(self, code: str, message: str, status: int):
        self.code, self.message, self.status = code, message, status


def _safe_route(function):
    @wraps(function)
    def wrapped(*args, **kwargs):
        try:
            return function(*args, **kwargs)
        except ChatProblem as exc:
            return jsonify({"error": {"code": exc.code, "message": exc.message}}), exc.status
        except Exception as exc:
            # Exception details may include credentials or input. Log the class only.
            current_app.logger.error("Chat operation failed (%s).", type(exc).__name__)
            return jsonify({"error": {"code": "chat_unavailable",
                                     "message": "Chat could not complete this request. Please retry."}}), 503
    return wrapped


def _config() -> ChatConfig:
    try:
        return ChatConfig.from_env()
    except ValueError as exc:
        raise ChatProblem("chat_not_configured", "Chat configuration is incomplete or invalid.", 503) from exc


def _profiles(config):
    try:
        return load_profiles(config.fixture_path, as_of=config.reference_date)
    except (OSError, ValueError) as exc:
        raise ChatProblem("demo_data_unavailable", "Plan information could not be loaded. Please retry.", 503) from exc


def _employee(profiles, employee_id):
    try:
        return profiles.employee(employee_id)
    except KeyError as exc:
        raise ChatProblem("unknown_employee", "Your plan information could not be found.", 404) from exc


def _with_reports(uid, employee):
    if not isinstance(uid, str) or not uid:
        raise ChatProblem("invalid_context", "This conversation needs a new signed-in session. Restart chat.", 409)
    reports = store.list_care_reports(uid, employee.employee_id)
    recorded = [record for report in reports if (record := report_usage(report)) is not None]
    return replace(employee, usage=[*employee.usage, *recorded])


def _object(value, message="Send a JSON object."):
    if not isinstance(value, dict):
        raise ChatProblem("invalid_input", message, 422)
    return value


def _procedure_choices():
    return [{"label": entry.label, "value": entry.id} for entry in catalog.PROCEDURE_CATALOG.values()]


def _network(value):
    if not isinstance(value, str):
        raise ValueError("Choose in-network or out-of-network.")
    return Network(value.strip().lower().replace("-", "_").replace(" ", "_"))


def _estimate(employee, procedure, network, treatment_date):
    result = engine.estimate(employee.plan, employee.usage, [procedure], network=network,
                             as_of=treatment_date, enrollment_date=employee.enrollment_date)
    return {**result.to_dict(), **employee.identity(), "procedure_id": procedure,
            "network": network.value, "treatment_date": treatment_date.isoformat(),
            "assumptions": list(ASSUMPTIONS), "demo_data": True}


def _estimate_text(estimate):
    line = estimate["lines"][0]
    text = (f"Approximate estimate for {line['label']}: insurance pays ${line['plan_pays']:,.2f} "
            f"and you owe ${line['employee_owes']:,.2f}. "
            f"The estimated remaining allowance after this care is ${estimate['annual_max_remaining_after']:,.2f}. "
            "Your recorded benefits usage has not changed.")
    if line["reasons"]:
        text += " " + " ".join(line["reasons"])
    return text


def _fulfillment(employee, config, text, *, estimate=None, choices=None,
                 status="ok", parameters=None, inputs=None):
    payload = {"type": "dental_benefits", "status": status,
               "benefits": employee.benefits(config.reference_date),
               "estimate": estimate, "choices": choices or [], "inputs": inputs or {},
               "prompt": text}
    response = {"fulfillmentResponse": {"mergeBehavior": "REPLACE",
                                        "messages": [{"text": {"text": [text]}}]},
                "payload": payload}
    if parameters is not None:
        response["sessionInfo"] = {"parameters": parameters}
    return jsonify(response)


@chat.post("/dialogflow/webhook")
@_safe_route
def dialogflow_webhook():
    config = _config()
    expected = f"Bearer {config.webhook_token}".encode()
    if not hmac.compare_digest(request.headers.get("Authorization", "").encode(), expected):
        raise ChatProblem("unauthorized_webhook", "Webhook authorization is required.", 401)
    body = _object(request.get_json(silent=True))
    info = _object(body.get("sessionInfo"), "Webhook sessionInfo is required.")
    parameters = _object(info.get("parameters"), "Webhook parameters are required.")
    fulfillment = _object(body.get("fulfillmentInfo"), "Webhook fulfillmentInfo is required.")
    if not isinstance(fulfillment.get("tag"), str):
        raise ChatProblem("invalid_input", "A webhook fulfillment tag is required.", 422)
    profiles = _profiles(config)
    try:
        claims = SessionSigner(config.signing_key).verify(
            parameters.get("backend_context"), fixture_set_id=profiles.fixture_set_id)
        if not claims.uid:
            raise ValueError("Old session")
        if info.get("session") != config.session_path(claims.session_id):
            raise ValueError("Session mismatch.")
    except ValueError as exc:
        raise ChatProblem("invalid_context", "Invalid or expired session. Start a new conversation.", 409) from exc
    employee = _with_reports(claims.uid, _employee(profiles, claims.employee_id))
    if fulfillment["tag"] == "benefits.summary":
        benefits = employee.benefits(config.reference_date)
        return _fulfillment(employee, config,
            f"Your plan has ${benefits['remaining']:,.2f} "
            "remaining this plan year. What procedure are you planning?", choices=_procedure_choices())
    if fulfillment["tag"] != "benefits.estimate":
        return _fulfillment(employee, config, "I can help estimate one procedure under your current plan.",
                            choices=_procedure_choices(), status="needs_input")
    procedure = parameters.get("procedure")
    if not isinstance(procedure, str) or procedure not in catalog.PROCEDURE_CATALOG:
        return _fulfillment(employee, config, "Which supported dental procedure are you planning?",
                            choices=_procedure_choices(), status="needs_input", parameters={"procedure": None})
    try:
        network = _network(parameters.get("network"))
    except ValueError:
        return _fulfillment(employee, config, "Will you use an in-network or out-of-network dentist?",
                            choices=NETWORK_CHOICES, status="needs_input", parameters={"network": None})
    try:
        treatment_date = iso_date(parameters["treatment_date"]) if parameters.get("treatment_date") is not None else config.reference_date
    except ValueError:
        return _fulfillment(employee, config, "Please give the treatment date in YYYY-MM-DD format.",
                            status="needs_input", parameters={"treatment_date": None})
    estimate = _estimate(employee, procedure, network, treatment_date)
    choices = [{"label": "Change network", "value": "change network"},
               {"label": "Another procedure", "value": "another procedure"}]
    inputs = {"procedure": procedure, "network": network.value, "treatment_date": treatment_date.isoformat()}
    return _fulfillment(employee, config, _estimate_text(estimate), estimate=estimate, choices=choices,
                        parameters={"network": network.value}, inputs=inputs)


def _dialogflow_error():
    return ChatProblem("dialogflow_unavailable", "The conversation could not be refreshed. Please retry.", 503)


@chat.post("/chat")
@_safe_route
@require_user
def post_chat():
    body = _object(request.get_json(silent=True))
    if set(body) - {"employee_id", "session_id", "text", "event"}:
        raise ChatProblem("invalid_input", "Only employee_id, session_id, text or event are supported.", 422)
    employee_id = body.get("employee_id")
    if not isinstance(employee_id, str) or not employee_id.strip():
        raise ChatProblem("invalid_input", "Your plan information is required.", 422)
    if ("text" in body) == ("event" in body):
        raise ChatProblem("invalid_input", "Provide exactly one of text or event.", 422)
    if "text" in body:
        text = body["text"]
        if not isinstance(text, str) or not text.strip() or len(text) > 1000:
            raise ChatProblem("invalid_input", "Send a nonempty message of at most 1000 characters.", 422)
        text = text.strip()
    else:
        if body["event"] not in ("start", "restart"):
            raise ChatProblem("invalid_input", "Supported events are start and restart.", 422)
        text = "hello"
    token = body.get("session_id")
    if token is not None and not isinstance(token, str):
        raise ChatProblem("invalid_input", "session_id must be a string.", 422)
    config = _config()
    profiles = _profiles(config)
    employee = _with_reports(g.uid, _employee(profiles, employee_id))
    signer = SessionSigner(config.signing_key)
    if token is None or body.get("event") == "restart":
        token = signer.create(employee_id, profiles.fixture_set_id, uid=g.uid)
    try:
        claims = signer.verify(token, employee_id=employee_id,
                               fixture_set_id=profiles.fixture_set_id, uid=g.uid)
    except ValueError as exc:
        raise ChatProblem("invalid_context", "Invalid or expired session. Start a new conversation.", 409) from exc
    try:
        response = dialogflow_client.detect_intent(config, claims.session_id, token, text)
    except Exception as exc:
        current_app.logger.warning("Dialogflow request failed (%s).", type(exc).__name__)
        raise _dialogflow_error() from exc
    result = response.get("queryResult")
    if not isinstance(result, dict):
        raise _dialogflow_error()
    if any(status.get("code", 0) != 0 for status in result.get("webhookStatuses", [])):
        raise _dialogflow_error()
    messages = []
    for message in result.get("responseMessages", []):
        messages.extend(value for value in message.get("text", {}).get("text", []) if isinstance(value, str))
    state = result.get("currentPage", {}).get("displayName", "")
    choices = NETWORK_CHOICES if state == "Network" else _procedure_choices() if state == "Procedure" else []
    estimate = None
    payloads = [payload for payload in result.get("webhookPayloads", [])
                if isinstance(payload, dict) and payload.get("type") == "dental_benefits"]
    # Only the final fulfillment controls the displayed result and message.
    for payload in payloads[-1:]:
        if payload.get("status") not in ("ok", "needs_input"):
            raise _dialogflow_error()
        choices = payload.get("choices", [])
        estimate = None
        if payload.get("status") == "ok" and payload.get("estimate") is not None:
            inputs = payload.get("inputs", {})
            procedure = inputs.get("procedure")
            if not isinstance(procedure, str) or procedure not in catalog.PROCEDURE_CATALOG:
                raise _dialogflow_error()
            try:
                expected = _estimate(employee, procedure, _network(inputs.get("network")),
                                     iso_date(inputs.get("treatment_date")))
            except ValueError as exc:
                raise _dialogflow_error() from exc
            if expected != payload["estimate"]:
                raise _dialogflow_error()
            estimate = expected
            # Financial prose is always regenerated from the verified engine result.
            messages = [_estimate_text(estimate)]
        elif payload.get("status") == "ok":
            benefits = employee.benefits(config.reference_date)
            messages = [f"Your plan has "
                        f"${benefits['remaining']:,.2f} remaining this plan year. "
                        "What procedure are you planning?"]
        else:
            prompt = payload.get("prompt")
            if not isinstance(prompt, str) or not prompt.strip():
                raise _dialogflow_error()
            messages = [prompt]
    if not messages:
        raise _dialogflow_error()
    return jsonify({"session_id": token, "messages": messages, "choices": choices,
                    "conversation_state": state, "estimate": estimate,
                    "benefits": employee.benefits(config.reference_date),
                    "conversation_mode": "dialogflow", "demo_data": True})
