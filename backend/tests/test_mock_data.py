"""Unit tests for the Data/ entity models (company, person, procedure).

Pure tests — no firebase_admin, no network. Loaders read the local fixtures in
``Data/`` that ship with the repo.

Run from the backend/ directory:
    python -m pytest
"""

from __future__ import annotations

import pytest

from dental import mock_data
from dental.mock_data import Company, Person, Procedure
from dental.models import Category


# --------------------------------------------------------------------------- #
# Procedure
# --------------------------------------------------------------------------- #

def test_procedure_sentinels_and_category_blank():
    # The fixture is a placeholder template: dentalID -1, empty category,
    # money fields -1, date "timestamp".
    proc = mock_data.load_procedure()
    assert proc.category is None            # blank category -> None
    assert proc.cost is None                # -1 -> None
    assert proc.individual_paid is None
    assert proc.insurance_paid is None
    assert proc.deductible_paid is None
    assert proc.date is None                # "timestamp" placeholder -> None


def test_procedure_round_trips_with_category_and_money():
    data = {
        "dentalID": "d-100",
        "category": "Major",
        "description": "Root canal",
        "cost": 1000,
        "individualPaid": 525,
        "insurancePaid": 475,
        "deductiblePaid": 50,
        "date": "2026-03-01",
    }
    proc = Procedure.from_dict(data)
    assert proc.category == Category.MAJOR
    assert proc.cost == 1000
    assert proc.deductible_paid == 50
    # Round-trip back to the JSON shape.
    out = proc.to_dict()
    assert out["category"] == "Major"
    assert out["deductiblePaid"] == 50
    assert Procedure.from_dict(out) == proc


def test_procedure_unknown_category_rejected():
    with pytest.raises(ValueError):
        Procedure.from_dict({"dentalID": "x", "category": "Nonsense"})


# --------------------------------------------------------------------------- #
# Company
# --------------------------------------------------------------------------- #

def test_company_loads_and_round_trips():
    company = mock_data.load_company()
    # Placeholder fixture has empty strings; model keeps them as strings.
    assert isinstance(company.name, str)
    assert isinstance(company.company_id, str)
    assert isinstance(company.plan_id, str)
    assert Company.from_dict(company.to_dict()) == company


def test_company_plan_id_is_string():
    company = Company.from_dict({"name": "Acme", "companyID": "co-1", "planID": "C0"})
    assert company.plan_id == "C0"


# --------------------------------------------------------------------------- #
# Person — parsing + sentinels
# --------------------------------------------------------------------------- #

def test_person_fixture_sentinels():
    person = mock_data.load_person()
    # person.json placeholder: ID -1, empty ledger, totals default to 0 (derived).
    assert person.procedure_year == []
    assert person.coverage_used == 0.0
    assert person.deduct_payed == 0.0
    # preferedOffice "AddressHere" placeholder -> None.
    assert person.prefered_office is None


# --------------------------------------------------------------------------- #
# Person — derived totals (ledger is truth; totals are a rebuilt cache)
# --------------------------------------------------------------------------- #

def _proc(dental_id: str, insurance: float, deductible: float) -> Procedure:
    return Procedure(
        dental_id=dental_id,
        category=Category.BASIC,
        cost=insurance + deductible,
        insurance_paid=insurance,
        deductible_paid=deductible,
        date="2026-02-01",
    )


def test_totals_derived_from_ledger_on_construction():
    person = Person(
        person_id="p1",
        procedure_year=[_proc("a", 100, 50), _proc("b", 200, 0)],
        # Pass deliberately WRONG cached totals; __post_init__ must override them.
        deduct_payed=999,
        coverage_used=999,
    )
    assert person.coverage_used == 300.0  # 100 + 200
    assert person.deduct_payed == 50.0    # 50 + 0


def test_add_procedure_updates_totals():
    person = Person(person_id="p1")
    assert person.coverage_used == 0.0
    added = person.add_procedure(_proc("a", 475, 50))
    assert added is True
    assert person.coverage_used == 475.0
    assert person.deduct_payed == 50.0


def test_add_procedure_is_idempotent_by_dental_id():
    person = Person(person_id="p1")
    person.add_procedure(_proc("a", 475, 50))
    # Re-adding the same dentalID is a no-op: no double counting (FR-017).
    added_again = person.add_procedure(_proc("a", 475, 50))
    assert added_again is False
    assert len(person.procedure_year) == 1
    assert person.coverage_used == 475.0
    assert person.deduct_payed == 50.0


def test_person_round_trip_preserves_ledger_and_totals():
    person = Person(
        person_id="p1",
        company="co-1",
        plan_id="C0",
        email="a@b.com",
        procedure_year=[_proc("a", 100, 50)],
    )
    out = person.to_dict()
    assert out["coveragedUsed"] == 100.0
    assert out["deductPayed"] == 50.0
    again = Person.from_dict(out)
    assert again.coverage_used == 100.0
    assert again.deduct_payed == 50.0
    assert len(again.procedure_year) == 1
