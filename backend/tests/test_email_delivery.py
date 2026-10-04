"""Reminder email templates and the Resend adapter. Nothing here sends mail."""

from __future__ import annotations

import json
import re
from datetime import date
from io import BytesIO
from urllib.error import HTTPError, URLError

import pytest

import email_delivery
from dental import catalog

SIGN_IN = "https://app.example.com/index.html"


class Response:
    def __init__(self, body=b'{"id":"email-1"}'):
        self.body = body

    def __enter__(self):
        return self

    def __exit__(self, *_args):
        return False

    def read(self):
        return self.body


def sender(opener, url=SIGN_IN):
    return email_delivery.ResendEmailSender(
        api_key="re_secret_key", from_email="Dental Deal Detector <care@example.com>",
        sign_in_url=url, opener=opener)


def http_error(status, body=b"provider secret body"):
    return HTTPError("https://api.resend.com/emails", status, "secret reason", {}, BytesIO(body))


# --------------------------------------------------------------------------- #
# Configuration
# --------------------------------------------------------------------------- #

@pytest.mark.parametrize("missing", ["RESEND_API_KEY", "REMINDER_FROM_EMAIL", "APP_SIGN_IN_URL"])
def test_delivery_is_disabled_without_complete_configuration(monkeypatch, missing):
    monkeypatch.setenv("RESEND_API_KEY", "re_key")
    monkeypatch.setenv("REMINDER_FROM_EMAIL", "care@example.com")
    monkeypatch.setenv("APP_SIGN_IN_URL", SIGN_IN)
    monkeypatch.delenv(missing)
    with pytest.raises(email_delivery.EmailDeliveryError) as exc:
        email_delivery.ResendEmailSender.from_environment()
    assert exc.value.code == "delivery_disabled"


def test_sign_in_url_must_be_https(monkeypatch):
    monkeypatch.setenv("RESEND_API_KEY", "re_key")
    monkeypatch.setenv("REMINDER_FROM_EMAIL", "care@example.com")
    monkeypatch.setenv("APP_SIGN_IN_URL", "http://app.example.com")
    with pytest.raises(email_delivery.EmailDeliveryError) as exc:
        email_delivery.ResendEmailSender.from_environment()
    assert exc.value.code == "invalid_sign_in_url"


def test_configured_sender_hides_the_key(monkeypatch):
    monkeypatch.setenv("RESEND_API_KEY", "re_very_secret")
    monkeypatch.setenv("REMINDER_FROM_EMAIL", "care@example.com")
    monkeypatch.setenv("APP_SIGN_IN_URL", SIGN_IN)
    configured = email_delivery.ResendEmailSender.from_environment()
    assert configured.sign_in_url == SIGN_IN
    assert "re_very_secret" not in repr(configured)


# --------------------------------------------------------------------------- #
# Templates
# --------------------------------------------------------------------------- #

def rendered():
    return [
        email_delivery.inactivity_email(SIGN_IN),
        email_delivery.benefits_email(SIGN_IN, plan_year_label="2026",
                                      resets_on=date(2027, 1, 1)),
    ]


def test_inactivity_email_asks_for_a_review_without_naming_buttons():
    message = email_delivery.inactivity_email(SIGN_IN)
    assert message.subject == "Please review your dental profile"
    assert "90 days" in message.text
    assert "review your dental history" in message.text
    assert "nothing has changed" in message.text
    assert "No, nothing new" not in message.text


def test_benefits_email_names_plan_year_and_reset_date_only():
    message = email_delivery.benefits_email(SIGN_IN, plan_year_label="2026",
                                            resets_on=date(2027, 1, 1))
    assert message.subject == "Your dental benefits reset soon"
    assert "most of your dental benefits for the 2026 plan year" in message.text
    assert "January 1, 2027" in message.text
    assert SIGN_IN + "?reminder=benefits" in message.text


@pytest.mark.parametrize("message", rendered(), ids=["inactivity", "benefits"])
def test_emails_contain_no_amounts_history_or_identifiers(message):
    for body in (message.subject, message.text, message.html):
        assert "$" not in body
        assert not re.search(r"\d[\d,]*\.\d{2}\b", body)
        assert not re.search(r"\b\d{1,3}(,\d{3})+\b", body)
        lowered = body.lower()
        for entry in catalog.PROCEDURE_CATALOG.values():
            assert entry.label.lower() not in lowered
        for forbidden in ("filling", "crown", "root canal", "uid", "reminder/", "re_"):
            assert forbidden not in lowered
    assert "fictional" in message.text
    assert "privacy" in message.text.lower()
    assert message.text.count("https://") == 1
    assert message.html.count("href=") == 1
    assert "<img" not in message.html


def test_html_values_are_escaped():
    message = email_delivery.benefits_email('https://app.example.com/x?a="b"&c=<d>',
                                            plan_year_label="<2026>", resets_on=date(2027, 1, 1))
    assert "<2026>" not in message.html
    assert "&lt;2026&gt;" in message.html
    assert '"b"' not in message.html


@pytest.mark.parametrize("url,expected", [
    (SIGN_IN, SIGN_IN + "?reminder=benefits"),
    ("https://app.example.com/index.html?lang=en", "https://app.example.com/index.html?lang=en&reminder=benefits"),
    ("https://app.example.com/#top", "https://app.example.com/?reminder=benefits#top"),
    ("https://app.example.com/?reminder=other", "https://app.example.com/?reminder=benefits"),
])
def test_benefits_landing_url(url, expected):
    assert email_delivery.benefits_landing_url(url) == expected


# --------------------------------------------------------------------------- #
# Resend adapter
# --------------------------------------------------------------------------- #

def test_resend_request_is_stable_and_idempotent():
    seen = []

    def opener(request, timeout):
        seen.append((request, timeout))
        return Response()

    message = email_delivery.inactivity_email(SIGN_IN)
    configured = sender(opener)
    assert configured.send(to="person@example.com", message=message, idempotency_key="key-1") == "email-1"
    configured.send(to="person@example.com", message=message, idempotency_key="key-1")

    first, timeout = seen[0]
    assert first.full_url == "https://api.resend.com/emails"
    assert first.get_method() == "POST"
    assert first.headers["Idempotency-key"] == "key-1"
    assert first.headers["Authorization"] == "Bearer re_secret_key"
    assert timeout == 8
    assert seen[0][0].data == seen[1][0].data
    payload = json.loads(first.data)
    assert payload == {"from": "Dental Deal Detector <care@example.com>", "to": ["person@example.com"],
                       "subject": message.subject, "text": message.text, "html": message.html}


@pytest.mark.parametrize("status,body,code,retryable,uncertain", [
    (429, b"{}", "retryable_rate_limit", True, False),
    (503, b"{}", "retryable_provider", True, True),
    (400, b"{}", "permanent_request", False, False),
    (409, b'{"name":"concurrent_idempotent_requests"}', "retryable_concurrent", True, True),
    (409, b'{"name":"invalid_idempotent_request"}', "idempotency_conflict", False, False),
    (409, b'["not","an","object"]', "idempotency_conflict", False, False),
    (409, b"not json", "idempotency_conflict", False, False),
])
def test_http_failures_are_safely_categorized(status, body, code, retryable, uncertain):
    def opener(request, timeout):
        raise http_error(status, body)

    with pytest.raises(email_delivery.EmailDeliveryError) as exc:
        sender(opener).send(to="person@example.com", message=rendered()[0], idempotency_key="same")
    assert (exc.value.code, exc.value.retryable, exc.value.uncertain) == (code, retryable, uncertain)
    assert "secret" not in str(exc.value)
    assert exc.value.__cause__ is None


@pytest.mark.parametrize("failure", [URLError("host secret-token"), TimeoutError("secret-token")])
def test_transport_failure_is_retryable_and_redacted(failure):
    def opener(_request, timeout):
        raise failure

    with pytest.raises(email_delivery.EmailDeliveryError) as exc:
        sender(opener).send(to="person@example.com", message=rendered()[0], idempotency_key="same")
    assert exc.value.code == "retryable_transport"
    assert exc.value.retryable and exc.value.uncertain
    assert "secret-token" not in str(exc.value)


@pytest.mark.parametrize("body", [b"{}", b"not json", b'["id"]'])
def test_unexpected_provider_body_is_uncertain(body):
    with pytest.raises(email_delivery.EmailDeliveryError) as exc:
        sender(lambda request, timeout: Response(body)).send(
            to="person@example.com", message=rendered()[0], idempotency_key="same")
    assert exc.value.code == "invalid_provider_response"
    assert exc.value.uncertain


def test_logging_sender_never_contacts_a_provider(capsys):
    logged = email_delivery.LoggingEmailSender(SIGN_IN)
    message_id = logged.send(to="person@example.com", message=rendered()[1], idempotency_key="k")
    assert message_id.startswith("logged-")
    out = capsys.readouterr().out
    assert "Your dental benefits reset soon" in out
    assert "person@example.com" not in out
