"""Environment configuration and portable signed demo-session references."""

from __future__ import annotations

import base64
import binascii
import hashlib
import hmac
import json
import os
import re
import time
import uuid
from dataclasses import dataclass, field
from datetime import date

from chat_profiles import iso_date

REQUIRED_ENV = ("DIALOGFLOW_PROJECT_ID", "DIALOGFLOW_LOCATION", "DIALOGFLOW_AGENT_ID",
                "CHAT_SIGNING_KEY", "DIALOGFLOW_WEBHOOK_TOKEN")
SESSION_SECONDS = 1800


@dataclass(frozen=True)
class ChatConfig:
    project_id: str
    location: str
    agent_id: str
    signing_key: str = field(repr=False)
    webhook_token: str = field(repr=False)
    language_code: str = "en"
    reference_date: date = field(default_factory=date.today)
    fixture_path: str | None = None

    @classmethod
    def from_env(cls) -> "ChatConfig":
        values = [os.environ.get(key, "") for key in REQUIRED_ENV]
        if any(not value.strip() for value in values):
            raise ValueError("Chat configuration is incomplete.")
        if any(not re.fullmatch(r"[a-zA-Z0-9_-]+", value) for value in values[:3]):
            raise ValueError("Invalid Dialogflow resource identifiers.")
        if any(len(value) < 32 for value in values[3:]):
            raise ValueError("Chat keys and tokens must contain at least 32 characters.")
        reference_date = iso_date(os.environ["CHAT_REFERENCE_DATE"]) if os.environ.get("CHAT_REFERENCE_DATE") else date.today()
        return cls(*values, language_code=os.environ.get("DIALOGFLOW_LANGUAGE_CODE", "en"),
                   reference_date=reference_date, fixture_path=os.environ.get("CHAT_FIXTURE_PATH"))

    @property
    def api_endpoint(self) -> str:
        return "dialogflow.googleapis.com" if self.location == "global" else f"{self.location}-dialogflow.googleapis.com"

    def session_path(self, session_id: str) -> str:
        return f"projects/{self.project_id}/locations/{self.location}/agents/{self.agent_id}/sessions/{session_id}"


@dataclass(frozen=True)
class SessionClaims:
    employee_id: str
    fixture_set_id: str
    session_id: str
    issued_at: int
    expires_at: int


class SessionSigner:
    def __init__(self, key: str):
        if not isinstance(key, str) or len(key) < 32:
            raise ValueError("A signing key of at least 32 characters is required.")
        self._key = key.encode()

    def create(self, employee_id: str, fixture_set_id: str, *, now: int | None = None) -> str:
        now = int(time.time()) if now is None else now
        body = {"v": 1, "employee_id": employee_id, "fixture_set_id": fixture_set_id,
                "session_id": uuid.uuid4().hex, "issued_at": now, "expires_at": now + SESSION_SECONDS}
        encoded = base64.urlsafe_b64encode(json.dumps(body, separators=(",", ":")).encode()).decode().rstrip("=")
        signature = hmac.new(self._key, encoded.encode(), hashlib.sha256).hexdigest()
        return f"{encoded}.{signature}"

    def verify(self, token: object, *, employee_id: str | None = None,
               fixture_set_id: str | None = None, now: int | None = None) -> SessionClaims:
        try:
            if not isinstance(token, str) or len(token) > 2048:
                raise ValueError
            encoded, signature = token.split(".")
            if not re.fullmatch(r"[0-9a-f]{64}", signature):
                raise ValueError
            expected = hmac.new(self._key, encoded.encode(), hashlib.sha256).hexdigest()
            if not hmac.compare_digest(signature, expected):
                raise ValueError
            raw = base64.b64decode(encoded + "=" * (-len(encoded) % 4), altchars=b"-_", validate=True)
            body = json.loads(raw)
            if body["v"] != 1:
                raise ValueError
            claims = SessionClaims(**{key: body[key] for key in SessionClaims.__dataclass_fields__})
            now = int(time.time()) if now is None else now
            if (type(claims.issued_at) is not int or type(claims.expires_at) is not int
                    or claims.issued_at > now or now >= claims.expires_at
                    or claims.expires_at - claims.issued_at != SESSION_SECONDS
                    or not isinstance(claims.session_id, str)
                    or not re.fullmatch(r"[0-9a-f]{32}", claims.session_id)
                    or not isinstance(claims.employee_id, str) or not claims.employee_id
                    or not isinstance(claims.fixture_set_id, str) or not claims.fixture_set_id
                    or (employee_id is not None and claims.employee_id != employee_id)
                    or (fixture_set_id is not None and claims.fixture_set_id != fixture_set_id)):
                raise ValueError
            return claims
        except (ValueError, TypeError, KeyError, UnicodeError, binascii.Error) as exc:
            raise ValueError("Invalid or expired chat session. Start a new conversation.") from exc
