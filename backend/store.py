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
"""

from __future__ import annotations

import functools
import os
from typing import Any, Optional

from firebase_admin import firestore
from google.cloud import firestore as cloud_firestore

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
    user_ref(profile.uid).set(profile.to_dict())


def get_user_profile(uid: str) -> Optional[UserProfile]:
    snap = user_ref(uid).get()
    if not snap.exists:
        return None
    return UserProfile.from_dict({"uid": snap.id, **snap.to_dict()})
