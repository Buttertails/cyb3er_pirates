"""Privacy-minimal transactional reminder email.

Templates never contain dollar amounts, dental history, user identifiers, or
credentials; each links only to the app's normal sign-in page. Live sending is
disabled unless every required environment value is present, and tests inject
an opener, so importing or exercising this module never sends mail.
"""

from __future__ import annotations

import json
import os
from dataclasses import dataclass, field
from datetime import date
from html import escape
from typing import Callable
from urllib.error import HTTPError, URLError
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit
from urllib.request import Request, urlopen
from uuid import uuid4


RESEND_URL = "https://api.resend.com/emails"
APP_NAME = "Dental Deal Detector"
BENEFITS_LANDING = "benefits"

_PRIVACY = ("For your privacy, this email does not include any dental-history or plan details. "
            "If you did not expect this message, do not use the link; open the application directly.")
_DEMO = f"{APP_NAME} is a demonstration app that uses fictional plan data."


class EmailDeliveryError(RuntimeError):
    """A redacted delivery failure category; never carries provider text."""

    def __init__(self, code: str, retryable: bool = False, uncertain: bool = False):
        super().__init__(code.replace("_", " "))
        self.code = code
        self.retryable = retryable
        self.uncertain = uncertain


@dataclass(frozen=True)
class EmailMessage:
    subject: str
    text: str
    html: str


# --------------------------------------------------------------------------- #
# Templates
# --------------------------------------------------------------------------- #

def _long_date(value: date) -> str:
    return f"{value.strftime('%B')} {value.day}, {value.year}"


def _render(subject: str, paragraphs: list[str], link_text: str, url: str) -> EmailMessage:
    text = "\n\n".join([*paragraphs, f"{link_text}: {url}", _PRIVACY, _DEMO])
    html = "".join(
        [f"<p>{escape(p)}</p>" for p in paragraphs]
        + [f'<p><a href="{escape(url, quote=True)}">{escape(link_text)}</a></p>',
           f"<p>{escape(_PRIVACY)}</p>", f"<p>{escape(_DEMO)}</p>"])
    return EmailMessage(subject, text, html)


def inactivity_email(sign_in_url: str) -> EmailMessage:
    return _render(
        "Please review your dental profile",
        [f"It's been about 90 days since you last signed in to {APP_NAME}.",
         "Please sign in to review your dental history. "
         "If nothing has changed, you can confirm that in a few seconds."],
        "Sign in", sign_in_url)


def benefits_email(sign_in_url: str, *, plan_year_label: str, resets_on: date) -> EmailMessage:
    return _render(
        "Your dental benefits reset soon",
        [f"You still have most of your dental benefits for the {plan_year_label} plan year.",
         f"Unused benefits don't roll over — they reset on {_long_date(resets_on)}. "
         "Sign in to see what's left and plan any care before then."],
        "See my benefits", benefits_landing_url(sign_in_url))


def benefits_landing_url(sign_in_url: str) -> str:
    """Add the allowlisted landing marker, keeping any other query and fragment."""
    parts = urlsplit(sign_in_url)
    query = [(k, v) for k, v in parse_qsl(parts.query, keep_blank_values=True) if k != "reminder"]
    query.append(("reminder", BENEFITS_LANDING))
    return urlunsplit((parts.scheme, parts.netloc, parts.path, urlencode(query), parts.fragment))


# --------------------------------------------------------------------------- #
# Senders
# --------------------------------------------------------------------------- #

def _conflict_name(error: HTTPError) -> str | None:
    try:
        body = json.loads(error.read().decode("utf-8"))
    except Exception:  # noqa: BLE001 - provider bodies are never trusted or kept
        return None
    return body.get("name") if isinstance(body, dict) else None


@dataclass
class ResendEmailSender:
    api_key: str = field(repr=False)
    from_email: str
    sign_in_url: str
    opener: Callable = field(default=urlopen, repr=False)
    timeout_seconds: int = 8

    @classmethod
    def from_environment(cls) -> "ResendEmailSender":
        api_key = os.environ.get("RESEND_API_KEY", "").strip()
        from_email = os.environ.get("REMINDER_FROM_EMAIL", "").strip()
        sign_in_url = os.environ.get("APP_SIGN_IN_URL", "").strip()
        if not api_key or not from_email or not sign_in_url:
            raise EmailDeliveryError("delivery_disabled")
        if not sign_in_url.startswith("https://"):
            raise EmailDeliveryError("invalid_sign_in_url")
        return cls(api_key, from_email, sign_in_url)

    def send(self, *, to: str, message: EmailMessage, idempotency_key: str) -> str:
        payload = {"from": self.from_email, "to": [to], "subject": message.subject,
                   "text": message.text, "html": message.html}
        request = Request(
            RESEND_URL,
            data=json.dumps(payload, ensure_ascii=False, separators=(",", ":")).encode("utf-8"),
            headers={"Authorization": f"Bearer {self.api_key}",
                     "Content-Type": "application/json",
                     "Idempotency-Key": idempotency_key},
            method="POST",
        )
        try:
            with self.opener(request, timeout=self.timeout_seconds) as response:
                body = json.loads(response.read().decode("utf-8"))
        except HTTPError as exc:
            raise self._http_failure(exc) from None
        except (URLError, TimeoutError, OSError):
            raise EmailDeliveryError("retryable_transport", retryable=True, uncertain=True) from None
        except ValueError:
            raise EmailDeliveryError("invalid_provider_response", retryable=True, uncertain=True) from None
        message_id = body.get("id") if isinstance(body, dict) else None
        if not message_id:
            raise EmailDeliveryError("invalid_provider_response", retryable=True, uncertain=True)
        return str(message_id)

    @staticmethod
    def _http_failure(exc: HTTPError) -> EmailDeliveryError:
        if exc.code == 429:
            return EmailDeliveryError("retryable_rate_limit", retryable=True)
        if exc.code >= 500:
            return EmailDeliveryError("retryable_provider", retryable=True, uncertain=True)
        if exc.code == 409:
            if _conflict_name(exc) == "concurrent_idempotent_requests":
                return EmailDeliveryError("retryable_concurrent", retryable=True, uncertain=True)
            return EmailDeliveryError("idempotency_conflict")
        return EmailDeliveryError("permanent_request")


@dataclass
class LoggingEmailSender:
    """Local stand-in that prints the rendered email instead of sending it."""

    sign_in_url: str

    def send(self, *, to: str, message: EmailMessage, idempotency_key: str) -> str:
        print(f"--- reminder email (not sent) ---\nSubject: {message.subject}\n\n{message.text}\n")
        return f"logged-{uuid4()}"
