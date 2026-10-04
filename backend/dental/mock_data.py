"""Models + loaders for the fictional entity data in the ``Data/`` folder.

Mirrors three JSON sources that accompany ``Data/plans.json`` (modeled in
:mod:`dental.mock_plans`):

    company.json   -> Company   (a company and the plan it offers)
    person.json    -> Person    (a policyholder: profile + usage ledger)
    procedure.json -> Procedure (one procedure performed in a benefit year)

Conventions shared with ``plans.json`` (see :mod:`dental.mock_plans`):
    * Money is in **dollars** (floats/ints), not cents.
    * ``-1`` is the "not set / not applicable" sentinel, decoded to ``None``.
    * Procedure categories use the same labels as plans: ``Routine`` / ``Basic``
      / ``Major`` / ``Orthodontia`` (mapped to the engine's :class:`Category`).

Derived totals (the key behavior)
----------------------------------
A :class:`Person` carries a procedure ledger (``procedure_year``) **and** two
running totals, ``deduct_payed`` and ``coverage_used``. The ledger is the single
source of truth; the totals are a *cache* derived from it:

    coverage_used = sum(procedure.insurance_paid)
    deduct_payed  = sum(procedure.deductible_paid)

The totals are only ever **recomputed from the ledger**, never incremented in
place, so they can't drift. :meth:`Person.add_procedure` de-duplicates by
``dentalID`` (so a retried write doesn't double-count) and then recomputes.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Optional

from .models import Category
from .mock_plans import (
    CATEGORY_BY_JSON_NAME,
    _decode_sentinel,
    _encode_sentinel,
    _json_name_for,
)
import json


# --------------------------------------------------------------------------- #
# Procedure (one entry in a person's benefit-year ledger)
# --------------------------------------------------------------------------- #

@dataclass
class Procedure:
    """A single procedure performed within a benefit year.

    Doubles as the catalog-ish description (``category`` / ``description`` /
    ``cost``) and the usage record (what was actually paid, and when).

    Money fields are in dollars; ``None`` means "not set" (the ``-1`` sentinel).
    ``deductible_paid`` is the portion of ``individual_paid`` that went to the
    deductible — stored explicitly so :class:`Person` can derive its totals by
    simple summation rather than re-adjudicating.
    """

    dental_id: str
    category: Optional[Category] = None
    description: str = ""
    cost: Optional[float] = None             # dollars; total allowed/charged
    individual_paid: Optional[float] = None  # dollars the member paid
    insurance_paid: Optional[float] = None   # dollars the plan paid
    deductible_paid: Optional[float] = None  # dollars of member payment that was deductible
    date: Optional[str] = None               # ISO date / timestamp of service

    def to_dict(self) -> dict[str, Any]:
        return {
            "dentalID": self.dental_id,
            "category": _json_name_for(self.category) if self.category is not None else "",
            "description": self.description,
            "cost": _encode_sentinel(self.cost),
            "individualPaid": _encode_sentinel(self.individual_paid),
            "insurancePaid": _encode_sentinel(self.insurance_paid),
            "deductiblePaid": _encode_sentinel(self.deductible_paid),
            "date": self.date if self.date is not None else "",
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "Procedure":
        category = _parse_category(data.get("category"))
        date_value = data.get("date")
        # Treat the empty/placeholder strings as "unset".
        if date_value in ("", "timestamp", None):
            date_value = None
        return cls(
            dental_id=str(data.get("dentalID", "")),
            category=category,
            description=data.get("description", "") or "",
            cost=_decode_sentinel(data.get("cost")),
            individual_paid=_decode_sentinel(data.get("individualPaid")),
            insurance_paid=_decode_sentinel(data.get("insurancePaid")),
            deductible_paid=_decode_sentinel(data.get("deductiblePaid")),
            date=date_value,
        )


def _parse_category(name: Any) -> Optional[Category]:
    """Map a plans-style category label to a :class:`Category` (``None`` if blank)."""
    if not name:
        return None
    category = CATEGORY_BY_JSON_NAME.get(name)
    if category is None:
        raise ValueError(f"Unknown procedure category: {name!r}")
    return category


# --------------------------------------------------------------------------- #
# Company (company.json)
# --------------------------------------------------------------------------- #

@dataclass
class Company:
    """A company and the single plan it offers.

    ``plan_id`` references a plan by its prefixed string id (e.g. ``"C0"``); see
    :func:`dental.mock_plans.normalize_plan_id`.
    """

    name: str = ""
    company_id: str = ""
    plan_id: str = ""

    def to_dict(self) -> dict[str, Any]:
        return {
            "name": self.name,
            "companyID": self.company_id,
            "planID": self.plan_id,
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "Company":
        return cls(
            name=data.get("name", "") or "",
            company_id=str(data.get("companyID", "") or ""),
            plan_id=str(data.get("planID", "") or ""),
        )


# --------------------------------------------------------------------------- #
# Person (person.json)
# --------------------------------------------------------------------------- #

@dataclass
class Person:
    """A policyholder: profile fields plus a benefit-year procedure ledger.

    ``procedure_year`` is the source of truth. ``deduct_payed`` and
    ``coverage_used`` are a derived cache kept in sync via
    :meth:`recompute_totals` (called automatically by :meth:`add_procedure`).
    """

    person_id: str
    company: str = ""
    plan_id: str = ""
    zipcode: Optional[str] = None
    prefered_office: Optional[str] = None
    email: str = ""
    procedure_year: list[Procedure] = field(default_factory=list)
    # Derived cache (dollars). Kept consistent with the ledger; never set directly.
    deduct_payed: float = 0.0
    coverage_used: float = 0.0

    def __post_init__(self) -> None:
        # Ensure the cached totals always reflect the ledger on construction,
        # regardless of what (if anything) the caller passed for them.
        self.recompute_totals()

    # -- derived totals ------------------------------------------------------ #

    def recompute_totals(self) -> None:
        """Rebuild ``deduct_payed`` / ``coverage_used`` from the ledger.

        This is the ONLY place these fields are assigned. ``coverage_used`` is
        the sum of insurer payments (what counts against the annual maximum);
        ``deduct_payed`` is the sum of the deductible portions.
        """
        self.coverage_used = round(
            sum(p.insurance_paid or 0.0 for p in self.procedure_year), 2
        )
        self.deduct_payed = round(
            sum(p.deductible_paid or 0.0 for p in self.procedure_year), 2
        )

    def add_procedure(self, procedure: Procedure) -> bool:
        """Add a procedure to the ledger, then recompute totals.

        Idempotent by ``dentalID``: adding a procedure whose id already exists
        is a no-op (so a retried submission doesn't double-count). Returns True
        if the procedure was added, False if it was a duplicate.
        """
        if any(p.dental_id == procedure.dental_id for p in self.procedure_year):
            return False
        self.procedure_year.append(procedure)
        self.recompute_totals()
        return True

    # -- serialization ------------------------------------------------------- #

    def to_dict(self) -> dict[str, Any]:
        return {
            "ID": self.person_id,
            "company": self.company,
            "planID": self.plan_id,
            "zipcode": self.zipcode if self.zipcode is not None else -1,
            "preferedOffice": self.prefered_office if self.prefered_office is not None else "",
            "deductPayed": self.deduct_payed,
            "coveragedUsed": self.coverage_used,
            "email": self.email,
            "procedureYear": [p.to_dict() for p in self.procedure_year],
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "Person":
        zipcode = data.get("zipcode")
        zipcode = None if zipcode in (-1, "", None) else str(zipcode)
        office = data.get("preferedOffice")
        if office in ("", "AddressHere", None):
            office = None
        return cls(
            person_id=str(data.get("ID", "")),
            company=str(data.get("company", "") or ""),
            plan_id=str(data.get("planID", "") or ""),
            zipcode=zipcode,
            prefered_office=office,
            email=data.get("email", "") or "",
            procedure_year=[
                Procedure.from_dict(p) for p in data.get("procedureYear", [])
            ],
        )


# --------------------------------------------------------------------------- #
# Loaders
# --------------------------------------------------------------------------- #

def _data_dir() -> Path:
    """The repo's ``Data/`` folder (sibling of ``backend/``)."""
    return Path(__file__).resolve().parents[2] / "Data"


def _load_json(filename: str, path: Optional[Path | str]) -> Any:
    p = Path(path) if path is not None else _data_dir() / filename
    with p.open("r", encoding="utf-8") as fh:
        return json.load(fh)


def load_company(path: Optional[Path | str] = None) -> Company:
    """Load ``Data/company.json`` into a :class:`Company`."""
    return Company.from_dict(_load_json("company.json", path))


def load_person(path: Optional[Path | str] = None) -> Person:
    """Load ``Data/person.json`` into a :class:`Person`."""
    return Person.from_dict(_load_json("person.json", path))


def load_procedure(path: Optional[Path | str] = None) -> Procedure:
    """Load ``Data/procedure.json`` into a :class:`Procedure`."""
    return Procedure.from_dict(_load_json("procedure.json", path))
