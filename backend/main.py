"""Standalone Flask server for the Dental Benefits Optimizer API.

Runs as a normal web server (not a Cloud Function). All API routes live under
the ``/api`` prefix via a Blueprint, so the frontend calls e.g.
``/api/estimate`` directly. The server can also serve the static ``frontend/``
so the whole demo runs from one origin (no CORS needed); CORS is enabled anyway
so a separately served frontend works too.

Run (dev):
    python main.py                       # http://127.0.0.1:8080
    # or choose a port:  PORT=5000 python main.py

Run (production WSGI, Windows-friendly):
    waitress-serve --listen=0.0.0.0:8080 main:app

Firestore / Auth credentials come from the environment (see store.py / auth.py):
    * Local: start the Firebase emulators and export FIRESTORE_EMULATOR_HOST +
      FIREBASE_AUTH_EMULATOR_HOST (and GOOGLE_CLOUD_PROJECT).
    * Deployed: Application Default Credentials (a service account).

Endpoints (all under /api)
--------------------------
Signed-in user (Authorization: Bearer <Firebase ID token>):
    GET  /api/me                                -> {uid, email, location: {state, zip} | null}
    PUT  /api/me/location   body: {state, zip}  -> same shape; saved once, reused on later sign-ins

Reference data:
    GET  /api/catalog
    GET  /api/mock-plans
    GET  /api/health

Guided chat (fictional employee context; no login dependency):
    POST /api/chat                              -> messages, benefits, estimate
    POST /api/dialogflow/webhook                -> authenticated CX fulfillment

Generic CRUD (Firestore-backed):
    POST /api/employers                         body: {id, name, active_plan_id?}
    GET  /api/employers/<eid>
    POST /api/employers/<eid>/plans             body: EmployerPlan dict
    GET  /api/employers/<eid>/plans/<pid>
    POST /api/employers/<eid>/employees         body: Employee dict
    GET  /api/employers/<eid>/employees/<empid>
    POST /api/employers/<eid>/employees/<empid>/usage   body: UsageRecord dict
    GET  /api/employers/<eid>/employees/<empid>/usage

Engine (deterministic model):
    POST /api/estimate     {employer_id, employee_id, procedures[], network?, as_of?}
    POST /api/compare      same body — in-network vs out-of-network
    POST /api/reminders    {employer_id, employee_id, as_of?}
    POST /api/sequence     {employer_id, employee_id, procedures[], network?, as_of?, urgent[]?}

Convenience:
    POST /api/seed         loads the sample employer/plan/employee/usage

Each engine endpoint resolves its plan from one of three sources (in priority
order): a ``plan_id`` (+ optional ``member_type``: "adult"/"children") naming a
fictional plan in ``Data/plans.json``; an inline ``plan`` (+ optional
``usage``); or ``employer_id`` + ``employee_id`` looked up from Firestore. The
first two need no Firestore, which is handy for the frontend demo and tests.
"""

from __future__ import annotations

import os
from datetime import date
from pathlib import Path
from typing import Any, Optional

import firebase_admin
from firebase_admin import initialize_app
from flask import Blueprint, Flask, g, jsonify, request, send_from_directory

try:
    from flask_cors import CORS
except ImportError:  # pragma: no cover - CORS is optional for same-origin use
    CORS = None

from auth import require_user
from chat_routes import chat
from dental import catalog, engine, locations, mock_plans, sequencing
from dental.mock_plans import MemberType
from dental.models import Employee, Employer, EmployerPlan, Network, UsageRecord, UserProfile
import store


def _init_firebase() -> None:
    """Initialize the Admin SDK once, tolerant of local runs without creds.

    ``initialize_app()`` normally discovers Application Default Credentials.
    Under the emulators that isn't needed, but the call can still fail if no
    creds are present; swallow that so the server boots for routes that don't
    touch Firestore/Auth (health, catalog, mock-plans, estimate by plan_id).
    """
    if firebase_admin._apps:  # already initialized
        return
    try:
        initialize_app()
    except Exception:  # noqa: BLE001 - best effort; Firestore/Auth routes will surface errors
        pass


_init_firebase()

# Where the static frontend lives (repo_root/frontend), served at "/".
_FRONTEND_DIR = Path(__file__).resolve().parents[1] / "frontend"

app = Flask(__name__)
app.register_blueprint(chat, url_prefix="/api")
if CORS is not None:
    CORS(app, resources={r"/api/*": {"origins": "*"}})

# All API routes hang off this blueprint, mounted at /api.
api_bp = Blueprint("api", __name__)


# --------------------------------------------------------------------------- #
# Helpers
# --------------------------------------------------------------------------- #

def _parse_as_of(value: Optional[str]) -> Optional[date]:
    return date.fromisoformat(value) if value else None


def _network(value: Optional[str]) -> Network:
    return Network(value) if value else Network.IN_NETWORK


def _member_type(value: Optional[str]) -> MemberType:
    return MemberType(value) if value else MemberType.ADULT


def _resolve_plan_and_usage(body: dict[str, Any]) -> tuple[EmployerPlan, list[UsageRecord], Optional[str]]:
    """Load the plan + usage from one of three sources, in priority order:

    1. ``plan_id`` (+ optional ``member_type``) — a fictional plan from
       ``Data/plans.json``, adapted to the engine's plan shape.
    2. inline ``plan`` (+ optional ``usage``) carried directly in the body.
    3. ``employer_id`` + ``employee_id`` looked up from Firestore.

    Returns (plan, usage, enrollment_date). Raises ValueError with a message
    suitable for a 400 response if inputs are missing/invalid.
    """
    enrollment_date: Optional[str] = body.get("enrollment_date")

    # Mock-plan mode: resolve a fictional plan from Data/plans.json by planId.
    if "plan_id" in body:
        plans = mock_plans.load_mock_plans_by_id()
        plan_id = str(body["plan_id"]).strip()
        mock = plans.get(plan_id)
        if mock is None:
            raise ValueError(f"No plan with planId {plan_id!r} in plans.json.")
        member_type = _member_type(body.get("member_type"))
        if not mock.offers(member_type):
            raise ValueError(
                f"Plan {mock.name!r} does not offer {member_type.value} coverage."
            )
        plan = mock.to_employer_plan(member_type)
        usage = [UsageRecord.from_dict(u) for u in body.get("usage", [])]
        return plan, usage, enrollment_date

    # Inline mode: body carries the plan (and optionally usage) directly.
    if "plan" in body:
        plan = EmployerPlan.from_dict(body["plan"])
        usage = [UsageRecord.from_dict(u) for u in body.get("usage", [])]
        return plan, usage, enrollment_date

    # Firestore mode: look everything up by IDs.
    employer_id = body.get("employer_id")
    employee_id = body.get("employee_id")
    if not employer_id or not employee_id:
        raise ValueError("Provide either an inline 'plan' or 'employer_id' + 'employee_id'.")

    employee = store.get_employee(employer_id, employee_id)
    if employee is None:
        raise ValueError(f"Employee '{employee_id}' not found for employer '{employer_id}'.")

    plan_id = employee.plan_id
    if not plan_id:
        employer = store.get_employer(employer_id)
        plan_id = employer.active_plan_id if employer else None
    if not plan_id:
        raise ValueError("No plan associated with this employee/employer.")

    plan = store.get_plan(employer_id, plan_id)
    if plan is None:
        raise ValueError(f"Plan '{plan_id}' not found.")

    usage = store.list_usage(employer_id, employee_id)
    return plan, usage, enrollment_date or employee.enrollment_date


# --------------------------------------------------------------------------- #
# Signed-in user
# --------------------------------------------------------------------------- #

def _me_json(profile: Optional[UserProfile]) -> dict[str, Any]:
    location = None
    if profile is not None and profile.state:
        location = {"state": profile.state, "zip": profile.zip}
    return {"uid": g.uid, "email": g.email, "location": location}


@api_bp.get("/me")
@require_user
def read_me():
    return jsonify(_me_json(store.get_user_profile(g.uid)))


@api_bp.put("/me/location")
@require_user
def put_my_location():
    body = request.get_json(silent=True) or {}
    try:
        state, zip_code = locations.validate_location(body.get("state"), body.get("zip"))
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 422

    profile = store.get_user_profile(g.uid) or UserProfile(uid=g.uid)
    profile.email = g.email
    profile.state = state
    profile.zip = zip_code
    store.save_user_profile(profile)
    return jsonify(_me_json(profile))


# --------------------------------------------------------------------------- #
# Reference data
# --------------------------------------------------------------------------- #

@api_bp.get("/health")
def health():
    return jsonify({"status": "ok"})


@api_bp.get("/catalog")
def get_catalog():
    return jsonify(
        {"procedures": [e.to_dict() for e in catalog.PROCEDURE_CATALOG.values()]}
    )


@api_bp.get("/mock-plans")
def get_mock_plans():
    """List the fictional company plans from Data/plans.json.

    Returned in the source JSON shape so the frontend can show plan options
    (name, group flag, max coverage, per-member coverage, premiums).
    """
    try:
        plans = mock_plans.load_mock_plans()
    except (FileNotFoundError, ValueError) as exc:
        return jsonify({"error": f"Could not load plans.json: {exc}"}), 500
    return jsonify({"plans": [p.to_dict() for p in plans]})


# --------------------------------------------------------------------------- #
# Generic CRUD
# --------------------------------------------------------------------------- #

@api_bp.post("/employers")
def create_employer():
    body = request.get_json(force=True)
    employer = Employer.from_dict(body)
    store.save_employer(employer)
    return jsonify(employer.to_dict()), 201


@api_bp.get("/employers/<eid>")
def read_employer(eid: str):
    employer = store.get_employer(eid)
    if employer is None:
        return jsonify({"error": "not found"}), 404
    return jsonify(employer.to_dict())


@api_bp.post("/employers/<eid>/plans")
def create_plan(eid: str):
    body = request.get_json(force=True)
    body["employer_id"] = eid
    plan = EmployerPlan.from_dict(body)
    store.save_plan(plan)
    return jsonify(plan.to_dict()), 201


@api_bp.get("/employers/<eid>/plans/<pid>")
def read_plan(eid: str, pid: str):
    plan = store.get_plan(eid, pid)
    if plan is None:
        return jsonify({"error": "not found"}), 404
    return jsonify(plan.to_dict())


@api_bp.post("/employers/<eid>/employees")
def create_employee(eid: str):
    body = request.get_json(force=True)
    body["employer_id"] = eid
    employee = Employee.from_dict(body)
    store.save_employee(employee)
    return jsonify(employee.to_dict()), 201


@api_bp.get("/employers/<eid>/employees/<empid>")
def read_employee(eid: str, empid: str):
    employee = store.get_employee(eid, empid)
    if employee is None:
        return jsonify({"error": "not found"}), 404
    return jsonify(employee.to_dict())


@api_bp.post("/employers/<eid>/employees/<empid>/usage")
def create_usage(eid: str, empid: str):
    body = request.get_json(force=True)
    record = UsageRecord.from_dict(body)
    store.add_usage(eid, empid, record)
    return jsonify(record.to_dict()), 201


@api_bp.get("/employers/<eid>/employees/<empid>/usage")
def read_usage(eid: str, empid: str):
    records = store.list_usage(eid, empid)
    return jsonify({"usage": [r.to_dict() for r in records]})


# --------------------------------------------------------------------------- #
# Engine endpoints
# --------------------------------------------------------------------------- #

@api_bp.post("/estimate")
def post_estimate():
    body = request.get_json(force=True)
    try:
        plan, usage, enrollment = _resolve_plan_and_usage(body)
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400
    result = engine.estimate(
        plan, usage, body.get("procedures", []),
        network=_network(body.get("network")),
        as_of=_parse_as_of(body.get("as_of")),
        enrollment_date=enrollment,
    )
    return jsonify(result.to_dict())


@api_bp.post("/compare")
def post_compare():
    body = request.get_json(force=True)
    try:
        plan, usage, enrollment = _resolve_plan_and_usage(body)
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400
    result = engine.compare_networks(
        plan, usage, body.get("procedures", []),
        as_of=_parse_as_of(body.get("as_of")),
        enrollment_date=enrollment,
    )
    return jsonify(result)


@api_bp.post("/reminders")
def post_reminders():
    body = request.get_json(force=True)
    try:
        plan, usage, _ = _resolve_plan_and_usage(body)
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400
    result = engine.end_of_year_reminders(
        plan, usage, as_of=_parse_as_of(body.get("as_of"))
    )
    return jsonify(result)


@api_bp.post("/sequence")
def post_sequence():
    body = request.get_json(force=True)
    try:
        plan, usage, enrollment = _resolve_plan_and_usage(body)
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400
    result = sequencing.optimize_sequence(
        plan, usage, body.get("procedures", []),
        network=_network(body.get("network")),
        as_of=_parse_as_of(body.get("as_of")),
        enrollment_date=enrollment,
        urgent_procedure_ids=set(body.get("urgent", [])),
    )
    return jsonify(result)


# --------------------------------------------------------------------------- #
# Convenience: seed sample data
# --------------------------------------------------------------------------- #

@api_bp.post("/seed")
def post_seed():
    store.save_employer(catalog.SAMPLE_EMPLOYER)
    store.save_plan(catalog.sample_plan())
    store.save_employee(catalog.sample_employee())
    for record in catalog.sample_usage():
        store.add_usage(
            catalog.SAMPLE_EMPLOYER.id, catalog.sample_employee().id, record
        )
    return jsonify({"status": "seeded", "employer_id": catalog.SAMPLE_EMPLOYER.id}), 201


# --------------------------------------------------------------------------- #
# Wire up the app: mount the API under /api, serve the static frontend at /
# --------------------------------------------------------------------------- #

app.register_blueprint(api_bp, url_prefix="/api")


@app.get("/")
def _index():
    return _serve_frontend("index.html")


@app.get("/<path:filename>")
def _serve_frontend(filename: str):
    """Serve the static frontend so the whole demo runs from one origin.

    Falls back to a 404 JSON for missing files. API routes are matched first
    because they live under the /api prefix.
    """
    target = (_FRONTEND_DIR / filename)
    if _FRONTEND_DIR.exists() and target.is_file():
        return send_from_directory(_FRONTEND_DIR, filename)
    return jsonify({"error": "not found"}), 404


# --------------------------------------------------------------------------- #
# Dev server entry point. For production use a WSGI server, e.g.:
#   waitress-serve --listen=0.0.0.0:8080 main:app
# --------------------------------------------------------------------------- #

if __name__ == "__main__":
    port = int(os.environ.get("PORT", "8080"))
    host = os.environ.get("HOST", "127.0.0.1")
    debug = os.environ.get("FLASK_DEBUG", "").lower() in ("1", "true", "yes")
    app.run(host=host, port=port, debug=debug)
