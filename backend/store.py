"""Thin Firestore repository layer.

Isolates all Firestore access so the pure engine (dental/) never imports
firebase_admin. The Cloud Functions entry point (main.py) uses these helpers to
load typed models, run the engine, and persist documents.

Collection layout:
    employers/{employerId}
    employers/{employerId}/plans/{planId}
    employers/{employerId}/employees/{employeeId}
    employers/{employerId}/employees/{employeeId}/usage/{usageId}
    users/{uid}
    users/{uid}/demo_employees/{employeeId}/procedures/{submissionId}
    users/{uid}/demo_employees/{employeeId}/saved_plans/{recordId}
"""

from __future__ import annotations

import functools
import os
from typing import Any, Optional

from firebase_admin import firestore
from google.cloud import firestore as cloud_firestore
from datetime import datetime, timezone

from dental.models import Employee, Employer, EmployerPlan, UsageRecord, UserProfile


def db():
    """Return the Firestore client (lazily, so imports don't require init)."""
    if os.environ.get("FIRESTORE_EMULATOR_HOST"):
        return _emulator_client()
    return firestore.client()


@functools.cache
def _emulator_client():
    """Firestore client for the emulator.

    The Admin SDK's ``firestore.client()`` insists on Google credentials, which
    don't exist locally. The plain client connects to the emulator with
    anonymous credentials on its own.
    """
    project = os.environ.get("GCLOUD_PROJECT") or os.environ.get("GOOGLE_CLOUD_PROJECT")
    return cloud_firestore.Client(project=project)


# --------------------------------------------------------------------------- #
# Employers
# --------------------------------------------------------------------------- #

def employer_ref(employer_id: str):
    return db().collection("employers").document(employer_id)


def save_employer(employer: Employer) -> None:
    employer_ref(employer.id).set(employer.to_dict())


def get_employer(employer_id: str) -> Optional[Employer]:
    snap = employer_ref(employer_id).get()
    if not snap.exists:
        return None
    return Employer.from_dict({"id": snap.id, **snap.to_dict()})


# --------------------------------------------------------------------------- #
# Plans
# --------------------------------------------------------------------------- #

def plan_ref(employer_id: str, plan_id: str):
    return employer_ref(employer_id).collection("plans").document(plan_id)


def save_plan(plan: EmployerPlan) -> None:
    plan_ref(plan.employer_id, plan.id).set(plan.to_dict())


def get_plan(employer_id: str, plan_id: str) -> Optional[EmployerPlan]:
    snap = plan_ref(employer_id, plan_id).get()
    if not snap.exists:
        return None
    return EmployerPlan.from_dict({"id": snap.id, **snap.to_dict()})


# --------------------------------------------------------------------------- #
# Employees
# --------------------------------------------------------------------------- #

def employee_ref(employer_id: str, employee_id: str):
    return employer_ref(employer_id).collection("employees").document(employee_id)


def save_employee(employee: Employee) -> None:
    employee_ref(employee.employer_id, employee.id).set(employee.to_dict())


def get_employee(employer_id: str, employee_id: str) -> Optional[Employee]:
    snap = employee_ref(employer_id, employee_id).get()
    if not snap.exists:
        return None
    return Employee.from_dict({"id": snap.id, **snap.to_dict()})


# --------------------------------------------------------------------------- #
# Usage ledger
# --------------------------------------------------------------------------- #

def usage_collection(employer_id: str, employee_id: str):
    return employee_ref(employer_id, employee_id).collection("usage")


def add_usage(employer_id: str, employee_id: str, record: UsageRecord) -> None:
    usage_collection(employer_id, employee_id).document(record.id).set(record.to_dict())


def list_usage(employer_id: str, employee_id: str) -> list[UsageRecord]:
    docs = usage_collection(employer_id, employee_id).stream()
    return [UsageRecord.from_dict({"id": d.id, **d.to_dict()}) for d in docs]


# --------------------------------------------------------------------------- #
# Signed-in users
# --------------------------------------------------------------------------- #

def user_ref(uid: str):
    return db().collection("users").document(uid)


def save_user_profile(profile: UserProfile) -> None:
    user_ref(profile.uid).set(profile.to_dict(), merge=True)


def patch_user_profile(uid: str, fields: dict[str, Any]) -> None:
    """Merge only fields supplied by this request, preserving concurrent edits."""
    user_ref(uid).set(fields, merge=True)


def get_user_profile(uid: str) -> Optional[UserProfile]:
    snap = user_ref(uid).get()
    if not snap.exists:
        return None
    return UserProfile.from_dict({"uid": snap.id, **snap.to_dict()})


def care_collection(uid: str, employee_id: str):
    return user_ref(uid).collection("demo_employees").document(employee_id).collection("procedures")


def list_care_reports(uid: str, employee_id: str) -> list[dict[str, Any]]:
    return [snap.to_dict() for snap in care_collection(uid, employee_id).stream()]


# --------------------------------------------------------------------------- #
# Saved estimates / sequence plans (snapshots the user chose to keep)
# --------------------------------------------------------------------------- #

def saved_plans_collection(uid: str, employee_id: str):
    return user_ref(uid).collection("demo_employees").document(employee_id).collection("saved_plans")


def save_plan_record(uid: str, employee_id: str, record: dict[str, Any]) -> dict[str, Any]:
    """Persist one saved estimate/sequence snapshot and return it.

    ``record`` must carry an ``id`` and ``kind`` ("estimate" or "sequence"); a
    server timestamp is stamped on write. Writing the same id again overwrites
    (idempotent, so a retried save doesn't duplicate).
    """
    saved = {**record, "saved_at": datetime.now(timezone.utc).isoformat()}
    saved_plans_collection(uid, employee_id).document(record["id"]).set(saved)
    return saved


def list_plan_records(uid: str, employee_id: str) -> list[dict[str, Any]]:
    """All saved snapshots for this employee, newest first."""
    records = [snap.to_dict() for snap in saved_plans_collection(uid, employee_id).stream()]
    return sorted(records, key=lambda r: r.get("saved_at", ""), reverse=True)


def delete_plan_record(uid: str, employee_id: str, record_id: str) -> None:
    saved_plans_collection(uid, employee_id).document(record_id).delete()


class CareConflict(Exception):
    pass


def _apply_care_batch(transaction, client, uid: str, employee_id: str,
                      reports: list[dict[str, Any]],
                      seed_paid_by_year: dict[str, int], annual_maximum_cents: int):
    root = client.collection("users").document(uid).collection("demo_employees").document(employee_id)
    report_refs = [root.collection("procedures").document(item["submission_id"]) for item in reports]
    prior = [next(transaction.get(ref)).to_dict() for ref in report_refs]
    years = sorted({item["date"][:4] + "-01-01" for item in reports})
    total_refs = {year: root.collection("usage_totals").document(year) for year in years}
    totals = {year: (next(transaction.get(ref)).to_dict() or {}).get("known_paid_cents", 0)
              for year, ref in total_refs.items()}
    for item, old in zip(reports, prior):
        if old is not None and any(old.get(key) != value for key, value in item.items()):
            raise CareConflict("A different report already uses this submission ID.")
    increments = {year: 0 for year in years}
    for item, old in zip(reports, prior):
        if old is None:
            increments[item["date"][:4] + "-01-01"] += item["insurance_paid_cents"] or 0
    for year, increment in increments.items():
        if seed_paid_by_year[year] + totals[year] + increment > annual_maximum_cents:
            raise ValueError("Known insurer payments exceed this fictional plan's annual allowance.")
    now = datetime.now(timezone.utc).isoformat()
    result = []
    for item, old, ref in zip(reports, prior, report_refs):
        if old is not None:
            result.append(old)
        else:
            saved = {**item, "recorded_at": now}
            transaction.create(ref, saved)
            result.append(saved)
    for year, increment in increments.items():
        if increment:
            transaction.set(total_refs[year], {"known_paid_cents": totals[year] + increment}, merge=True)
    return result


def commit_care_batch(uid: str, employee_id: str, reports: list[dict[str, Any]],
                      seed_paid_by_year: dict[str, int], annual_maximum_cents: int):
    if not reports:
        return []
    client = db()

    @cloud_firestore.transactional
    def write(transaction):
        return _apply_care_batch(transaction, client, uid, employee_id, reports,
                                 seed_paid_by_year, annual_maximum_cents)

    return write(client.transaction())
