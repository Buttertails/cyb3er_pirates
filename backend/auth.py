"""Firebase Authentication for the API.

The frontend signs users in with Firebase Auth and sends the user's ID token as
``Authorization: Bearer <token>``. ``require_user`` verifies it with the Admin
SDK before the view runs. Under the emulators no credentials are needed: the
Functions emulator sets FIREBASE_AUTH_EMULATOR_HOST when the Auth emulator runs.
"""

from __future__ import annotations

from functools import wraps

from firebase_admin import auth as firebase_auth
from flask import g, jsonify, request


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
