"""Unit tests for the Data/plans.json model, loader, and engine adapter.

Pure tests — no firebase_admin, no network. The loader reads the local
``Data/plans.json`` fixture that ships with the repo.

Run from the backend/ directory:
    python -m pytest
"""

from __future__ import annotations

from datetime import date

import pytest

from dental import engine, mock_plans
from dental.mock_plans import MemberType, MockPlan
from dental.models import Category, dollars


# --------------------------------------------------------------------------- #
# Loading the real fixture
# --------------------------------------------------------------------------- #

def test_load_mock_plans_from_fixture():
    plans = mock_plans.load_mock_plans()
    # plans.json ships with plans A, B, C.
    names = {p.name for p in plans}
    assert {"A", "B", "C"} <= names


def test_load_mock_plans_by_id_keys_on_plan_id():
    by_id = mock_plans.load_mock_plans_by_id()
    # Plan ids are prefixed strings: "C" for company/group plans, "I" for
    # independent plans. A (group) -> C0, B (independent) -> I1, C (group) -> C2.
    assert by_id["C0"].name == "A"
    assert by_id["I1"].name == "B"
    assert by_id["C2"].name == "C"


def test_plan_id_prefix_follows_group_flag():
    by_name = {p.name: p for p in mock_plans.load_mock_plans()}
    assert by_name["A"].plan_id == "C0"   # group -> C
    assert by_name["B"].plan_id == "I1"   # independent -> I
    assert by_name["C"].plan_id == "C2"   # group -> C


# --------------------------------------------------------------------------- #
# Parsing + sentinel handling
# --------------------------------------------------------------------------- #

def test_plan_a_parses_group_and_coverage():
    plan = mock_plans.load_mock_plans_by_id()["C0"]  # "A"
    assert plan.group is True
    assert plan.max_coverage == 7500
    # Adult covers Routine + Basic (preventive + basic).
    assert plan.adult.covers(Category.PREVENTIVE)
    assert plan.adult.covers(Category.BASIC)
    assert not plan.adult.covers(Category.MAJOR)
    # Children get the full set including Orthodontia.
    assert plan.children.covers(Category.ORTHODONTIC)
    # deductible -1 -> None
    assert plan.adult.deductible is None


def test_plan_b_unlimited_max_and_real_deductible():
    plan = mock_plans.load_mock_plans_by_id()["I1"]  # "B"
    # maxCoverage -1 -> unlimited (None).
    assert plan.max_coverage is None
    assert plan.group is False
    # Adult has a real $4500 deductible and a $32.88 premium.
    assert plan.adult.deductible == 4500
    assert plan.adult.premium == pytest.approx(32.88)
    # Children block is not offered (empty covered list).
    assert plan.children.is_offered is False
    assert plan.offers(MemberType.CHILDREN) is False


def test_empty_children_block_not_offered():
    plan = mock_plans.load_mock_plans_by_id()["C2"]  # "C"
    assert plan.offers(MemberType.ADULT) is True
    assert plan.offers(MemberType.CHILDREN) is False


# --------------------------------------------------------------------------- #
# Round-trip serialization (re-encodes the -1 sentinels)
# --------------------------------------------------------------------------- #

def test_round_trip_preserves_sentinels():
    plan = mock_plans.load_mock_plans_by_id()["I1"]  # "B": unlimited max, no kids
    d = plan.to_dict()
    assert d["maxCoverage"] == -1          # unlimited re-encoded as -1
    assert d["children"]["premium"] == -1  # not-applicable re-encoded as -1
    assert d["planId"] == "I1"             # prefixed string id round-trips
    # Re-parsing yields an equivalent object.
    again = MockPlan.from_dict(d)
    assert again == plan


def test_unknown_category_rejected():
    bad = {
        "name": "X", "planId": 9, "group": True, "maxCoverage": 1000,
        "adult": {"covered": ["Nonsense"], "premium": 1, "premiumCovered": 1, "deductible": -1},
        "children": {"covered": [], "premium": -1, "premiumCovered": -1, "deductible": -1},
    }
    with pytest.raises(ValueError):
        MockPlan.from_dict(bad)


# --------------------------------------------------------------------------- #
# Adapter into the engine's EmployerPlan
# --------------------------------------------------------------------------- #

def test_adapter_covered_category_uses_standard_rate():
    plan = mock_plans.load_mock_plans_by_id()["C0"]  # "A": adult covers Routine+Basic
    ep = plan.to_employer_plan(MemberType.ADULT)
    # Preventive covered at 100% in-network -> cleaning fully covered, $0 owed.
    est = engine.estimate(ep, [], ["cleaning"], as_of=date(2026, 6, 15))
    line = est.lines[0]
    assert line.covered is True
    assert line.plan_pays_cents == dollars(95)
    assert line.employee_owes_cents == 0


def test_adapter_uncovered_category_not_paid():
    plan = mock_plans.load_mock_plans_by_id()["C0"]  # "A": adult does NOT cover Major
    ep = plan.to_employer_plan(MemberType.ADULT)
    est = engine.estimate(
        ep, [], ["root-canal"], as_of=date(2026, 6, 15), enrollment_date="2020-01-01"
    )
    line = est.lines[0]
    assert line.covered is False
    assert line.plan_pays_cents == 0


def test_adapter_children_get_orthodontic_coverage():
    plan = mock_plans.load_mock_plans_by_id()["C0"]  # "A": children cover Orthodontia
    ep = plan.to_employer_plan(MemberType.CHILDREN)
    est = engine.estimate(
        ep, [], ["orthodontics"], as_of=date(2026, 6, 15), enrollment_date="2020-01-01"
    )
    line = est.lines[0]
    assert line.covered is True
    assert line.plan_pays_cents > 0


def test_adapter_unlimited_max_does_not_cap():
    plan = mock_plans.load_mock_plans_by_id()["I1"]  # "B": unlimited max, $4500 deductible
    ep = plan.to_employer_plan(MemberType.ADULT)
    # Major is covered for B's adult; with no annual-max cap the plan pays its
    # full coverage share of the post-deductible amount.
    est = engine.estimate(
        ep, [], ["implant"], as_of=date(2026, 6, 15), enrollment_date="2020-01-01"
    )
    line = est.lines[0]
    assert line.covered is True
    # The $4500 deductible applies, but it can't exceed the implant's $3000
    # in-network allowed amount, so only $3000 of deductible lands here.
    assert line.deductible_applied_cents == dollars(3000)
    # Deductible consumes the whole allowed amount, so the plan pays $0 on it
    # (but it is still "covered" — the category rate is non-zero).
    assert line.plan_pays_cents == 0
    assert line.employee_owes_cents == dollars(3000)


def test_adapter_rejects_unoffered_member_type():
    plan = mock_plans.load_mock_plans_by_id()["I1"]  # "B" has no children coverage
    with pytest.raises(ValueError):
        plan.to_employer_plan(MemberType.CHILDREN)
