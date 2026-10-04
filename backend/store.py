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
    users/{uid}/reminder_deliveries/{campaign}-{key}
"""

from __future__ import annotations

import functools
import os
from typing import Any, Optional
from uuid import uuid4

from firebase_admin import firestore
from google.cloud import firestore as cloud_firestore
from google.cloud.firestore_v1.base_query import FieldFilter
from datetime import datetime, timezone

from dental.models import Employee, Employer, EmployerPlan, UsageRecord, UserProfile, utc_datetime
import reminders


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


def record_sign_in(uid: str, email: Optional[str], now: Optional[datetime] = None) -> None:
    """Record a completed sign-in as a timestamp and start a new inactivity cycle."""
    patch_user_profile(uid, {"email": email,
                             "last_sign_in_at": now or datetime.now(timezone.utc),
                             "inactivity_cycle_id": str(uuid4())})


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


# --------------------------------------------------------------------------- #
# Reminder email deliveries (see reminders.py for the state machine)
# --------------------------------------------------------------------------- #

def _delivery_ref(client, uid: str, doc_id: str):
    return client.collection("users").document(uid).collection("reminder_deliveries").document(doc_id)


def _read(transaction, ref) -> Optional[dict[str, Any]]:
    snap = next(iter(transaction.get(ref)))
    return snap.to_dict() if snap.exists else None


def _apply_claim(transaction, client, campaign, candidate, job_id: str, now: datetime) -> str:
    """Recheck eligibility on fresh data, then claim. All reads precede writes."""
    user = client.collection("users").document(candidate.uid)
    delivery_ref = _delivery_ref(client, candidate.uid, candidate.doc_id)
    data = _read(transaction, user)
    delivery = _read(transaction, delivery_ref)
    profile = UserProfile.from_dict({**data, "uid": candidate.uid}) if data is not None else None
    employee_id = campaign.care_employee_id(profile) if profile is not None else None
    reports = None
    if employee_id:
        procedures = (user.collection("demo_employees").document(employee_id)
                      .collection("procedures").limit(500))
        reports = [snap.to_dict() for snap in transaction.get(procedures)]
    if not campaign.recheck(profile, reports, candidate, now):
        return "stale"
    outcome, fields = reminders.decide_claim(delivery, candidate, job_id, now)
    if fields:
        transaction.set(delivery_ref, fields, merge=True)
    return outcome


def _apply_delivery_change(transaction, client, candidate, decide) -> Optional[dict[str, Any]]:
    ref = _delivery_ref(client, candidate.uid, candidate.doc_id)
    fields = decide(_read(transaction, ref))
    if fields:
        transaction.set(ref, fields, merge=True)
    return fields


def _apply_skip(transaction, client, candidate, code: str, now: datetime) -> None:
    _apply_delivery_change(transaction, client, candidate,
                           lambda d: reminders.decide_skip(d, code, candidate, now))


def _apply_mark_sending(transaction, client, candidate, job_id: str, now: datetime) -> bool:
    return _apply_delivery_change(transaction, client, candidate,
                                  lambda d: reminders.decide_sending(d, job_id, now)) is not None


def _apply_mark_sent(transaction, client, candidate, provider_message_id: str, now: datetime) -> None:
    _apply_delivery_change(transaction, client, candidate,
                           lambda d: reminders.decide_sent(d, provider_message_id, now))


def _apply_failure(transaction, client, candidate, error, now: datetime) -> None:
    _apply_delivery_change(transaction, client, candidate,
                           lambda d: reminders.decide_failure(d, error, now))


class FirestoreReminderRepository:
    """Reminder data access for ``reminders.ReminderRunner``."""

    def __init__(self, client=None, page_size: int = 100):
        self.client = client or db()
        self.page_size = page_size

    def _transact(self, apply, *args):
        @cloud_firestore.transactional
        def run(transaction):
            return apply(transaction, self.client, *args)

        return run(self.client.transaction())

    def _paged(self, query):
        last = None
        while True:
            page = query.limit(self.page_size)
            if last is not None:
                page = page.start_after(last)
            snaps = list(page.stream())
            for snap in snaps:
                yield UserProfile.from_dict({**snap.to_dict(), "uid": snap.id})
            if len(snaps) < self.page_size:
                return
            last = snaps[-1]

    def inactive_profiles(self, cutoff: datetime):
        users = self.client.collection("users")
        return self._paged(users.where(filter=FieldFilter("last_sign_in_at", "<=", cutoff))
                           .order_by("last_sign_in_at"))

    def company_profiles(self, companies: list[str]):
        users = self.client.collection("users")
        return self._paged(users.where(filter=FieldFilter("company", "in", list(companies)))
                           .order_by("__name__"))

    def care_reports(self, uid: str, employee_id: str) -> list[dict[str, Any]]:
        procedures = (self.client.collection("users").document(uid).collection("demo_employees")
                      .document(employee_id).collection("procedures"))
        return [snap.to_dict() for snap in procedures.stream()]

    def delivery(self, candidate) -> Optional[dict[str, Any]]:
        snap = _delivery_ref(self.client, candidate.uid, candidate.doc_id).get()
        return snap.to_dict() if snap.exists else None

    def record_skip(self, candidate, code: str, now: datetime) -> None:
        self._transact(_apply_skip, candidate, code, now)

    def claim(self, campaign, candidate, job_id: str, now: datetime) -> str:
        return self._transact(_apply_claim, campaign, candidate, job_id, now)

    def mark_sending(self, candidate, job_id: str, now: datetime) -> bool:
        return self._transact(_apply_mark_sending, candidate, job_id, now)

    def mark_sent(self, candidate, provider_message_id: str, now: datetime) -> None:
        self._transact(_apply_mark_sent, candidate, provider_message_id, now)

    def mark_failure(self, candidate, error, now: datetime) -> None:
        self._transact(_apply_failure, candidate, error, now)


# --------------------------------------------------------------------------- #
# One-time backfill: legacy ISO-string sign-in times -> timestamps
# --------------------------------------------------------------------------- #

def _backfill_fields(data: dict[str, Any]) -> Optional[dict[str, Any]]:
    raw = data.get("last_sign_in_at")
    parsed = utc_datetime(raw)
    if parsed is None:
        return None
    fields: dict[str, Any] = {}
    if isinstance(raw, str):
        fields["last_sign_in_at"] = parsed
    if not data.get("inactivity_cycle_id"):
        fields["inactivity_cycle_id"] = str(uuid4())
    return fields or None


def _apply_backfill(transaction, client, uid: str) -> bool:
    ref = client.collection("users").document(uid)
    fields = _backfill_fields(_read(transaction, ref) or {})
    if fields:
        transaction.set(ref, fields, merge=True)
    return fields is not None


def backfill_sign_ins(apply: bool = False, client=None) -> dict[str, int]:
    """Count (and with ``apply``, convert) profiles the reminder query can't see."""
    client = client or db()
    counts = {"scanned": 0, "needs_update": 0, "updated": 0}
    for snap in client.collection("users").stream():
        counts["scanned"] += 1
        if _backfill_fields(snap.to_dict() or {}) is None:
            continue
        counts["needs_update"] += 1
        if apply:
            @cloud_firestore.transactional
            def run(transaction, uid=snap.id):
                return _apply_backfill(transaction, client, uid)

            if run(client.transaction()):
                counts["updated"] += 1
    return counts
