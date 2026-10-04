"""Small live CX adapter. Importing the Flask app never contacts Google."""

from __future__ import annotations

import re

from chat_context import ChatConfig


def _dentist_directory_request(text: str) -> bool:
    normalized = text.lower().replace("-", " ")
    if not re.search(r"\bdentists?\b", normalized):
        return False
    return bool(
        re.search(r"\b(find|show|list|locate)\b", normalized)
        or re.search(r"\bwhere\b", normalized)
        or re.search(r"\b(nearby|near|close)\b", normalized)
        or (re.search(r"\b(which|who)\b", normalized)
            and re.search(r"\b(take|accept|cover|in network)\b", normalized))
    )


def detect_intent(config: ChatConfig, session_id: str, context_token: str, text: str) -> dict:
    # ADC is resolved by the SDK only when a live chat turn is requested.
    from google.cloud import dialogflowcx_v3 as cx
    from google.protobuf.json_format import MessageToDict

    query = cx.QueryInput(language_code=config.language_code)
    if _dentist_directory_request(text):
        query.event = cx.EventInput(event="dentists.find")
    else:
        query.text = cx.TextInput(text=text)
    request = cx.DetectIntentRequest(
        session=config.session_path(session_id),
        query_input=query,
        query_params=cx.QueryParameters(parameters={"backend_context": context_token}),
    )
    with cx.SessionsClient(client_options={"api_endpoint": config.api_endpoint}) as client:
        response = client.detect_intent(request=request, retry=None, timeout=15)
    return MessageToDict(response._pb)
