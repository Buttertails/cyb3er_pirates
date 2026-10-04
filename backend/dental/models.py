"""Firestore-shaped domain models for the Dental Benefits Optimizer.

These dataclasses mirror the documents stored in Firestore. Each model provides
``from_dict`` / ``to_dict`` so the Cloud Functions layer can convert between
Firestore documents and typed Python objects without the engine knowing anything
about Firestore itself.

Collection layout
-----------------
    employers/{employerId}                         -> Employer
    employers/{employerId}/plans/{planId}          -> EmployerPlan
    employers/{employerId}/employees/{employeeId}  -> Employee
    .../employees/{employeeId}/usage/{usageId}     -> UsageRecord
    catalog/procedures/{procedureId}               -> ProcedureCatalogEntry (read-only)
    users/{uid}                                    -> UserProfile (keyed by Firebase Auth uid)

Money
-----
All monetary amounts are stored as **cents** (ints) to avoid floating-point
rounding errors in coverage math. Helper functions ``dollars`` / ``to_dollars``
convert at the boundaries (input parsing / display).
"""

from __future__ import annotations

from dataclasses import dataclass, field, asdict
from datetime import datetime, timezone
from enum import Enum
from typing import Any, Optional


# --------------------------------------------------------------------------- #
# Money helpers
# --------------------------------------------------------------------------- #

def dollars(amount: float | int) -> int:
    """Convert a dollar amount to integer cents. ``dollars(1500) -> 150000``."""
    return int(round(float(amount) * 100))


def to_dollars(cents: int) -> float:
    """Convert integer cents back to a float dollar amount for display."""
    return round(cents / 100, 2)


# --------------------------------------------------------------------------- #
# Enums
# --------------------------------------------------------------------------- #

class Category(str, Enum):
    """The three coverage buckets every dental plan uses."""

    PREVENTIVE = "preventive"   # cleanings, exams, x-rays — usually 100%
    BASIC = "basic"             # fillings, simple extractions — usually 80%
    MAJOR = "major"             # crowns, bridges, dentures, root canals — usually 50%
    ORTHODONTIC = "orthodontic"  # braces/aligners — often separate lifetime max
    COSMETIC = "cosmetic"       # whitening, veneers — usually NOT covered


class Network(str, Enum):
    IN_NETWORK = "in_network"
    OUT_OF_NETWORK = "out_of_network"


# --------------------------------------------------------------------------- #
# Procedure catalog (shared reference data)
# --------------------------------------------------------------------------- #

@dataclass
class ProcedureCatalogEntry:
    """A dental procedure the user can request.

    ``id`` matches the frontend's procedure IDs (e.g. "crown-bridge") so the
    intake flow and the engine speak the same language. ``cdt_codes`` lists the
    real ADA CDT billing codes this maps to, for reference/explanation.
    """

    id: str
    label: str
    category: Category
    cdt_codes: list[str] = field(default_factory=list)
    # Typical allowed amounts (cents) used when a plan has no custom fee schedule.
    typical_cost_in_network_cents: int = 0
    typical_cost_out_network_cents: int = 0
    description: str = ""

    def to_dict(self) -> dict[str, Any]:
        d = asdict(self)
        d["category"] = self.category.value
        return d

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "ProcedureCatalogEntry":
        return cls(
            id=data["id"],
            label=data["label"],
            category=Category(data["category"]),
            cdt_codes=list(data.get("cdt_codes", [])),
            typical_cost_in_network_cents=int(data.get("typical_cost_in_network_cents", 0)),
            typical_cost_out_network_cents=int(data.get("typical_cost_out_network_cents", 0)),
            description=data.get("description", ""),
        )


# --------------------------------------------------------------------------- #
# Employer + Plan
# --------------------------------------------------------------------------- #

@dataclass
class FrequencyLimit:
    """How often a procedure (or category) is covered within a plan year.

    ``per_year`` of 2 means "covered up to 2 times per plan year".
    ``per_months`` expresses limits like "1 crown on the same tooth every 60
    months" (set per_months=60). Use whichever applies; both may be set.
    """

    procedure_id: str
    per_year: Optional[int] = None
    per_months: Optional[int] = None
    note: str = ""

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "FrequencyLimit":
        return cls(
            procedure_id=data["procedure_id"],
            per_year=data.get("per_year"),
            per_months=data.get("per_months"),
            note=data.get("note", ""),
        )


@dataclass
class CoverageTier:
    """The plan's reimbursement rate for one category, by network."""

    category: Category
    in_network_rate: float          # 0.0–1.0 (e.g. 0.80 = plan pays 80%)
    out_network_rate: float
    waiting_period_months: int = 0  # months after enrollment before covered

    def to_dict(self) -> dict[str, Any]:
        d = asdict(self)
        d["category"] = self.category.value
        return d

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "CoverageTier":
        return cls(
            category=Category(data["category"]),
            in_network_rate=float(data["in_network_rate"]),
            out_network_rate=float(data["out_network_rate"]),
            waiting_period_months=int(data.get("waiting_period_months", 0)),
        )


@dataclass
class EmployerPlan:
    """The rulebook that governs every employee at an employer.

    Stored at employers/{employerId}/plans/{planId}.
    """

    id: str
    employer_id: str
    name: str
    # Plan year boundaries. ``plan_year_start_month`` is 1–12 (1 = January).
    plan_year_start_month: int = 1
    plan_year_start_day: int = 1
    annual_maximum_cents: int = dollars(1500)
    orthodontic_lifetime_maximum_cents: int = dollars(1500)
    individual_deductible_cents: int = dollars(50)
    # Preventive care is commonly exempt from the deductible.
    deductible_applies_to_preventive: bool = False
    coverage_tiers: list[CoverageTier] = field(default_factory=list)
    frequency_limits: list[FrequencyLimit] = field(default_factory=list)
    # Optional per-procedure negotiated fee schedule (cents). Overrides catalog.
    fee_schedule_in_network: dict[str, int] = field(default_factory=dict)
    fee_schedule_out_network: dict[str, int] = field(default_factory=dict)

    # -- convenience lookups ------------------------------------------------- #

    def tier_for(self, category: Category) -> Optional[CoverageTier]:
        for t in self.coverage_tiers:
            if t.category == category:
                return t
        return None

    def frequency_limit_for(self, procedure_id: str) -> Optional[FrequencyLimit]:
        for f in self.frequency_limits:
            if f.procedure_id == procedure_id:
                return f
        return None

    # -- serialization ------------------------------------------------------- #

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "employer_id": self.employer_id,
            "name": self.name,
            "plan_year_start_month": self.plan_year_start_month,
            "plan_year_start_day": self.plan_year_start_day,
            "annual_maximum_cents": self.annual_maximum_cents,
            "orthodontic_lifetime_maximum_cents": self.orthodontic_lifetime_maximum_cents,
            "individual_deductible_cents": self.individual_deductible_cents,
            "deductible_applies_to_preventive": self.deductible_applies_to_preventive,
            "coverage_tiers": [t.to_dict() for t in self.coverage_tiers],
            "frequency_limits": [f.to_dict() for f in self.frequency_limits],
            "fee_schedule_in_network": dict(self.fee_schedule_in_network),
            "fee_schedule_out_network": dict(self.fee_schedule_out_network),
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "EmployerPlan":
        return cls(
            id=data["id"],
            employer_id=data["employer_id"],
            name=data.get("name", ""),
            plan_year_start_month=int(data.get("plan_year_start_month", 1)),
            plan_year_start_day=int(data.get("plan_year_start_day", 1)),
            annual_maximum_cents=int(data.get("annual_maximum_cents", dollars(1500))),
            orthodontic_lifetime_maximum_cents=int(
                data.get("orthodontic_lifetime_maximum_cents", dollars(1500))
            ),
            individual_deductible_cents=int(data.get("individual_deductible_cents", dollars(50))),
            deductible_applies_to_preventive=bool(
                data.get("deductible_applies_to_preventive", False)
            ),
            coverage_tiers=[CoverageTier.from_dict(t) for t in data.get("coverage_tiers", [])],
            frequency_limits=[
                FrequencyLimit.from_dict(f) for f in data.get("frequency_limits", [])
            ],
            fee_schedule_in_network={
                k: int(v) for k, v in data.get("fee_schedule_in_network", {}).items()
            },
            fee_schedule_out_network={
                k: int(v) for k, v in data.get("fee_schedule_out_network", {}).items()
            },
        )


@dataclass
class Employer:
    id: str
    name: str
    active_plan_id: Optional[str] = None

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "Employer":
        return cls(
            id=data["id"],
            name=data.get("name", ""),
            active_plan_id=data.get("active_plan_id"),
        )


# --------------------------------------------------------------------------- #
# Employee + Usage
# --------------------------------------------------------------------------- #

@dataclass
class Employee:
    """A covered employee, tied to an employer (and thus that employer's plan)."""

    id: str
    employer_id: str
    name: str = ""
    plan_id: Optional[str] = None       # usually the employer's active plan
    enrollment_date: Optional[str] = None  # ISO date "YYYY-MM-DD"
    state: Optional[str] = None         # from the frontend location step
    zip: Optional[str] = None

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "Employee":
        return cls(
            id=data["id"],
            employer_id=data["employer_id"],
            name=data.get("name", ""),
            plan_id=data.get("plan_id"),
            enrollment_date=data.get("enrollment_date"),
            state=data.get("state"),
            zip=data.get("zip"),
        )


@dataclass
class UsageRecord:
    """A single procedure already claimed/performed within a plan year.

    This is the ledger that answers "how much of the annual max is used" and
    "how many cleanings have they already had this year". Stored at
    .../employees/{employeeId}/usage/{usageId}.
    """

    id: str
    procedure_id: str
    date: str                   # ISO date the service was performed, "YYYY-MM-DD"
    plan_pays_cents: int        # amount the plan paid (counts against annual max)
    employee_paid_cents: int = 0
    category: Optional[str] = None   # cached category for convenience
    tooth: Optional[str] = None      # for same-tooth frequency rules (e.g. "#14")
    network: str = Network.IN_NETWORK.value

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "UsageRecord":
        return cls(
            id=data["id"],
            procedure_id=data["procedure_id"],
            date=data["date"],
            plan_pays_cents=int(data.get("plan_pays_cents", 0)),
            employee_paid_cents=int(data.get("employee_paid_cents", 0)),
            category=data.get("category"),
            tooth=data.get("tooth"),
            network=data.get("network", Network.IN_NETWORK.value),
        )


# --------------------------------------------------------------------------- #
# Signed-in user
# --------------------------------------------------------------------------- #

def utc_datetime(value: Any) -> Optional[datetime]:
    """Read a stored instant as an aware UTC datetime.

    Accepts a Firestore timestamp (an aware ``datetime`` subclass), an aware
    ``datetime``, or a legacy ISO-8601 string. Naive or unreadable values become
    ``None`` rather than guessing a timezone.
    """
    if isinstance(value, str):
        try:
            value = datetime.fromisoformat(value.replace("Z", "+00:00"))
        except ValueError:
            return None
    if not isinstance(value, datetime) or value.tzinfo is None:
        return None
    return value.astimezone(timezone.utc)


@dataclass
class UserProfile:
    """What the backend remembers about a signed-in user, keyed by Firebase uid.

    The location is asked for once, then reused on later sign-ins.
    ``last_sign_in_at`` is stored as a Firestore timestamp; every recorded
    sign-in also starts a new ``inactivity_cycle_id`` used by reminder emails.
    """

    uid: str
    email: Optional[str] = None
    state: Optional[str] = None         # 2-letter code, see dental/locations.py
    zip: Optional[str] = None
    name: Optional[str] = None
    company: Optional[str] = None
    office: Optional[str] = None
    last_sign_in_at: Optional[datetime] = None
    inactivity_cycle_id: Optional[str] = None

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "UserProfile":
        return cls(
            uid=data["uid"],
            email=data.get("email"),
            state=data.get("state"),
            zip=data.get("zip"),
            name=data.get("name"),
            company=data.get("company"),
            office=data.get("office"),
            last_sign_in_at=utc_datetime(data.get("last_sign_in_at")),
            inactivity_cycle_id=data.get("inactivity_cycle_id"),
        )
