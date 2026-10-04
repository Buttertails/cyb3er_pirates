"""Small live CX adapter. Importing the Flask app never contacts Google."""

from __future__ import annotations

from chat_context import ChatConfig


def detect_intent(config: ChatConfig, session_id: str, context_token: str, text: str) -> dict:
    # ADC is resolved by the SDK only when a live chat turn is requested.
    from google.cloud import dialogflowcx_v3 as cx
    from google.protobuf.json_format import MessageToDict

    request = cx.DetectIntentRequest(
        session=config.session_path(session_id),
        query_input=cx.QueryInput(text=cx.TextInput(text=text), language_code=config.language_code),
        query_params=cx.QueryParameters(parameters={"backend_context": context_token}),
    )
    with cx.SessionsClient(client_options={"api_endpoint": config.api_endpoint}) as client:
        response = client.detect_intent(request=request, retry=None, timeout=15)
    return MessageToDict(response._pb)
