"""Firebase Authentication for the API.

The frontend signs users in with Firebase Auth and sends the user's ID token as
``Authorization: Bearer <token>``. ``require_user`` verifies it with the Admin
SDK before the view runs. Under the emulators no credentials are needed: the
Functions emulator sets FIREBASE_AUTH_EMULATOR_HOST when the Auth emulator runs.

``require_scheduler`` guards internal jobs: Cloud Scheduler sends a Google OIDC
token whose audience and service-account email must match the configuration.
"""

from __future__ import annotations

import os
from functools import wraps

from firebase_admin import auth as firebase_auth
from flask import g, jsonify, request
from google.auth.transport.requests import Request as GoogleRequest
from google.oauth2 import id_token as google_id_token


def _unauthorized():
    return jsonify({"error": "sign-in required"}), 401


def require_user(view):
    """Reject the request with 401 unless it carries a valid Firebase ID token.

    Sets ``g.uid`` and ``g.email`` for the view.
    """

    @wraps(view)
    def wrapper(*args, **kwargs):
        scheme, _, token = request.headers.get("Authorization", "").partition(" ")
        if scheme.lower() != "bearer" or not token.strip():
            return _unauthorized()
        try:
            claims = firebase_auth.verify_id_token(token.strip())
        except (ValueError, firebase_auth.InvalidIdTokenError):
            return _unauthorized()
        except firebase_auth.CertificateFetchError:
            return jsonify({"error": "sign-in check unavailable, try again"}), 503
        g.uid = claims["uid"]
        g.email = claims.get("email")
        return view(*args, **kwargs)

    return wrapper


def verify_google_id_token(token: str, audience: str) -> dict:
    return google_id_token.verify_oauth2_token(token, GoogleRequest(), audience=audience)


def require_scheduler(view):
    """Require the configured Cloud Scheduler OIDC service-account identity.

    Configure ``REMINDER_JOB_AUDIENCE`` (the direct Cloud Run URL) and
    ``REMINDER_JOB_SERVICE_ACCOUNT`` (the scheduler's service-account email).
    """

    @wraps(view)
    def wrapper(*args, **kwargs):
        audience = os.environ.get("REMINDER_JOB_AUDIENCE", "").strip()
        expected_email = os.environ.get("REMINDER_JOB_SERVICE_ACCOUNT", "").strip()
        if not audience or not expected_email:
            return jsonify({"error": "reminder job is not configured"}), 503
        scheme, _, token = request.headers.get("Authorization", "").partition(" ")
        if scheme.lower() != "bearer" or not token.strip():
            return jsonify({"error": "scheduler authentication required"}), 401
        try:
            claims = verify_google_id_token(token.strip(), audience)
        except Exception:  # noqa: BLE001 - verification details are intentionally hidden
            return jsonify({"error": "scheduler authentication rejected"}), 401
        if claims.get("email_verified") is not True or claims.get("email") != expected_email:
            return jsonify({"error": "scheduler identity is not allowed"}), 403
        g.scheduler_claims = claims
        return view(*args, **kwargs)

    return wrapper
