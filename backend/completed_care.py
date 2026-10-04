"""Validation for fictional, user-confirmed completed dental care."""

from __future__ import annotations

import re
from datetime import date
from decimal import Decimal, InvalidOperation

from dental.models import UsageRecord

HISTORY = {
    "checkup": {"cleaning", "exam-xrays", "deep-cleaning"},
    "general": {"filling", "crown-bridge", "root-canal", "extraction",
                "implant", "dentures", "orthodontics", "cosmetic", "other"},
}
ENGINE_ID = {"deep-cleaning": "cleaning", "other": "exam-xrays"}


def _cents(value):
    if value is None:
        return None
    if isinstance(value, bool):
        raise ValueError("Money must be a nonnegative amount.")
    try:
        amount = Decimal(str(value))
    except (InvalidOperation, ValueError):
        raise ValueError("Money must be a nonnegative amount.") from None
    if not amount.is_finite() or amount < 0 or amount.as_tuple().exponent < -2:
        raise ValueError("Money must have at most two decimal places.")
    return int(amount * 100)


def parse_report(raw, employee, *, today: date | None = None):
    if not isinstance(raw, dict) or set(raw) != {
        "submission_id", "procedure", "category", "date",
        "cost", "you_paid", "insurance_paid"
    }:
        raise ValueError("Provide one complete care report.")
    sid = raw["submission_id"]
    if not isinstance(sid, str) or not re.fullmatch(r"[A-Za-z0-9_-]{8,80}", sid):
        raise ValueError("Provide a valid submission ID.")
    category, procedure = raw["category"], raw["procedure"]
    if not isinstance(category, str) or not isinstance(procedure, str) or procedure not in HISTORY.get(category, set()):
        raise ValueError("Choose a supported completed procedure.")
    month = raw["date"]
    if not isinstance(month, str) or not re.fullmatch(r"\d{4}-(0[1-9]|1[0-2])", month):
        raise ValueError("Use a service month in YYYY-MM format.")
    service_date = date.fromisoformat(month + "-01")
    today = today or date.today()
    if service_date > today.replace(day=1):
        raise ValueError("The service month cannot be in the future.")
    cost, you_paid, insurance_paid = (_cents(raw[field]) for field in ("cost", "you_paid", "insurance_paid"))
    if cost is not None and (you_paid or 0) + (insurance_paid or 0) > cost:
        raise ValueError("Payments cannot exceed the total cost.")
    return {
        "submission_id": sid, "employee_id": employee.employee_id,
        "procedure": procedure, "category": category, "date": service_date.isoformat(),
        "cost_cents": cost, "you_paid_cents": you_paid,
        "insurance_paid_cents": insurance_paid,
    }


def report_usage(report):
    paid = report["insurance_paid_cents"]
    if paid is None:
        return None
    return UsageRecord(
        id="confirmed-" + report["submission_id"],
        procedure_id=ENGINE_ID.get(report["procedure"], report["procedure"]),
        date=report["date"], plan_pays_cents=paid,
        employee_paid_cents=report["you_paid_cents"] or 0,
        category=report["category"],
    )
