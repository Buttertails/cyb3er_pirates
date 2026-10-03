"""Unit tests for the deterministic dental engine.

These exercise the pure engine only (the `dental/` package), so they require
nothing beyond pytest — no firebase_admin, no network, no live Firestore.

Run from the backend/ directory:
    python -m pytest
"""

from __future__ import annotations

from datetime import date

import pytest

from dental import catalog, engine, sequencing
from dental.models import (
    Category,
    CoverageTier,
    EmployerPlan,
    FrequencyLimit,
    Network,
    UsageRecord,
    dollars,
    to_dollars,
)


# --------------------------------------------------------------------------- #
# Fixtures
# --------------------------------------------------------------------------- #

@pytest.fixture
def plan() -> EmployerPlan:
    return catalog.sample_plan()


@pytest.fixture
def as_of() -> date:
    # Mid-year so there's plenty of plan year left for most tests.
    return date(2026, 6, 15)


# --------------------------------------------------------------------------- #
# Plan-year window
# --------------------------------------------------------------------------- #

def test_plan_year_window_calendar(plan: EmployerPlan):
    start, end = engine.plan_year_window(plan, date(2026, 6, 15))
    assert start == date(2026, 1, 1)
    assert end == date(2027, 1, 1)


def test_plan_year_window_fiscal_july():
    plan = catalog.sample_plan()
    plan.plan_year_start_month = 7
    plan.plan_year_start_day = 1
    # March falls into the prior July-start window.
    start, end = engine.plan_year_window(plan, date(2026, 3, 10))
    assert start == date(2025, 7, 1)
    assert end == date(2026, 7, 1)


# --------------------------------------------------------------------------- #
# Core coverage math
# --------------------------------------------------------------------------- #

def test_preventive_fully_covered_no_deductible(plan: EmployerPlan, as_of: date):
    est = engine.estimate(plan, [], ["cleaning"], as_of=as_of)
    line = est.lines[0]
    # 100% in-network, deductible exempt for preventive.
    assert line.covered is True
    assert line.deductible_applied_cents == 0
    assert line.plan_pays_cents == dollars(95)
    assert line.employee_owes_cents == 0


def test_basic_filling_applies_deductible_then_80_percent(plan: EmployerPlan, as_of: date):
    # Allowed $200, $50 deductible first -> $150 @ 80% = $120 plan pays.
    est = engine.estimate(plan, [], ["filling"], as_of=as_of)
    line = est.lines[0]
    assert line.deductible_applied_cents == dollars(50)
    assert line.plan_pays_cents == dollars(120)
    assert line.employee_owes_cents == dollars(80)  # 200 - 120


def test_major_covered_50_percent_after_waiting_period(plan: EmployerPlan, as_of: date):
    # Enrolled well over 12 months ago, so the major waiting period is satisfied.
    est = engine.estimate(
        plan, [], ["root-canal"], as_of=as_of, enrollment_date="2024-01-01"
    )
    line = est.lines[0]
    assert line.covered is True
    # Allowed $1000, $50 deductible -> $950 @ 50% = $475.
    assert line.deductible_applied_cents == dollars(50)
    assert line.plan_pays_cents == dollars(475)
    assert line.employee_owes_cents == dollars(525)


def test_major_blocked_during_waiting_period(plan: EmployerPlan):
    # Enrolled only 3 months before the service date -> 12-month wait not met.
    est = engine.estimate(
        plan, [], ["crown-bridge"], as_of=date(2026, 4, 1), enrollment_date="2026-01-01"
    )
    line = est.lines[0]
    assert line.covered is False
    assert line.plan_pays_cents == 0
    assert line.employee_owes_cents == dollars(1200)  # full allowed amount
    assert any("waiting period" in r.lower() for r in line.reasons)


def test_cosmetic_not_covered(plan: EmployerPlan, as_of: date):
    est = engine.estimate(plan, [], ["cosmetic"], as_of=as_of)
    line = est.lines[0]
    assert line.covered is False
    assert line.plan_pays_cents == 0
    assert line.employee_owes_cents == dollars(600)


# --------------------------------------------------------------------------- #
# Frequency limits
# --------------------------------------------------------------------------- #

def test_third_cleaning_blocked_by_frequency(plan: EmployerPlan, as_of: date):
    usage = [
        UsageRecord("a", "cleaning", "2026-01-10", dollars(95)),
        UsageRecord("b", "cleaning", "2026-04-10", dollars(95)),
    ]
    est = engine.estimate(plan, usage, ["cleaning"], as_of=as_of)
    line = est.lines[0]
    assert line.covered is False
    assert any("frequency" in r.lower() for r in line.reasons)


def test_two_cleanings_in_one_request_trips_limit(plan: EmployerPlan, as_of: date):
    # No prior usage; request 3 cleanings — the 3rd should be blocked.
    est = engine.estimate(plan, [], ["cleaning", "cleaning", "cleaning"], as_of=as_of)
    assert est.lines[0].covered is True
    assert est.lines[1].covered is True
    assert est.lines[2].covered is False


# --------------------------------------------------------------------------- #
# Annual maximum
# --------------------------------------------------------------------------- #

def test_annual_max_caps_plan_payment(as_of: date):
    # Craft a plan with a tiny $300 annual max to force the cap.
    plan = catalog.sample_plan()
    plan.annual_maximum_cents = dollars(300)
    est = engine.estimate(
        plan, [], ["root-canal"], as_of=as_of, enrollment_date="2024-01-01"
    )
    line = est.lines[0]
    # Plan would pay $475 but is capped at the $300 remaining max.
    assert line.plan_pays_cents == dollars(300)
    assert est.annual_max_used_after_cents == dollars(300)


def test_annual_max_already_partly_used(plan: EmployerPlan, as_of: date):
    # $1400 already paid this year -> only $100 of the $1500 max remains.
    usage = [UsageRecord("x", "crown-bridge", "2026-02-01", dollars(1400))]
    est = engine.estimate(
        plan, usage, ["root-canal"], as_of=as_of, enrollment_date="2024-01-01"
    )
    assert est.annual_max_used_before_cents == dollars(1400)
    assert est.lines[0].plan_pays_cents == dollars(100)  # capped by remaining max


# --------------------------------------------------------------------------- #
# Bonus: annual max summary
# --------------------------------------------------------------------------- #

def test_annual_max_summary(plan: EmployerPlan, as_of: date):
    usage = catalog.sample_usage()  # cleaning $95 + filling $120 = $215 used
    summary = engine.annual_max_summary(plan, usage, as_of=as_of)
    assert summary["annual_maximum"] == 1500.0
    assert summary["used"] == to_dollars(dollars(215))
    assert summary["remaining"] == to_dollars(dollars(1285))


# --------------------------------------------------------------------------- #
# Bonus: network comparison
# --------------------------------------------------------------------------- #

def test_compare_networks_in_network_cheaper(plan: EmployerPlan, as_of: date):
    result = engine.compare_networks(
        plan, [], ["root-canal"], as_of=as_of, enrollment_date="2024-01-01"
    )
    in_owes = result["in_network"]["totals"]["employee_owes"]
    out_owes = result["out_of_network"]["totals"]["employee_owes"]
    assert out_owes > in_owes
    assert result["employee_savings_in_network"] > 0


# --------------------------------------------------------------------------- #
# Bonus: end-of-year reminders
# --------------------------------------------------------------------------- #

def test_reminders_fire_near_year_end(plan: EmployerPlan):
    # Late November: within the 90-day reminder window before Jan 1 reset.
    usage = catalog.sample_usage()
    result = engine.end_of_year_reminders(plan, usage, as_of=date(2026, 11, 20))
    assert result["within_reminder_window"] is True
    assert result["days_until_reset"] == (date(2027, 1, 1) - date(2026, 11, 20)).days
    assert len(result["reminders"]) >= 1


def test_reminders_quiet_early_in_year(plan: EmployerPlan):
    result = engine.end_of_year_reminders(plan, [], as_of=date(2026, 2, 1))
    assert result["within_reminder_window"] is False
    assert result["reminders"] == []


# --------------------------------------------------------------------------- #
# Sequencing optimizer
# --------------------------------------------------------------------------- #

def test_sequence_splits_when_max_insufficient():
    # Small $1000 max, two expensive crowns: splitting across years should help.
    plan = catalog.sample_plan()
    plan.annual_maximum_cents = dollars(1000)
    # Remove the major waiting period so coverage applies this year.
    for tier in plan.coverage_tiers:
        if tier.category == Category.MAJOR:
            tier.waiting_period_months = 0
    result = sequencing.optimize_sequence(
        plan, [], ["crown-bridge", "root-canal"],
        as_of=date(2026, 10, 1), enrollment_date="2024-01-01",
    )
    assert result["recommend_split"] is True
    # Something scheduled next year.
    assert any(s["when"] == "next_year" for s in result["schedule"])
    # Splitting should not cost more than doing everything now.
    assert result["estimated_cost_recommended"] <= result["estimated_cost_all_now"]


def test_sequence_no_split_when_max_sufficient():
    plan = catalog.sample_plan()  # $1500 max
    for tier in plan.coverage_tiers:
        if tier.category == Category.MAJOR:
            tier.waiting_period_months = 0
    # A single affordable procedure: no reason to split.
    result = sequencing.optimize_sequence(
        plan, [], ["filling"], as_of=date(2026, 6, 1), enrollment_date="2024-01-01"
    )
    assert result["recommend_split"] is False
    assert all(s["when"] == "this_year" for s in result["schedule"])


def test_sequence_keeps_urgent_this_year():
    plan = catalog.sample_plan()
    plan.annual_maximum_cents = dollars(1000)
    for tier in plan.coverage_tiers:
        if tier.category == Category.MAJOR:
            tier.waiting_period_months = 0
    result = sequencing.optimize_sequence(
        plan, [], ["root-canal", "crown-bridge"],
        as_of=date(2026, 10, 1), enrollment_date="2024-01-01",
        urgent_procedure_ids={"root-canal"},
    )
    # The urgent root canal must be scheduled this year.
    root = next(s for s in result["schedule"] if s["procedure_id"] == "root-canal")
    assert root["when"] == "this_year"
