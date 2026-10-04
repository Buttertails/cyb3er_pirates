"""Read-only demo context must not share usage or guess a company plan."""

import importlib
import json
from datetime import date
from pathlib import Path

import pytest

AS_OF = date(2026, 10, 3)


def profiles(path=None):
    return importlib.import_module("chat_profiles").load_profiles(path, as_of=AS_OF)


def test_same_company_employees_have_individual_usage():
    data = profiles()
    pat = data.employee("demo-a-pat").benefits(AS_OF)
    sam = data.employee("demo-a-sam").benefits(AS_OF)
    assert pat["plan_id"] == sam["plan_id"] == "C0"
    assert pat["company_id"] == sam["company_id"] == "demo-company-a"
    assert (pat["used"], pat["remaining"]) == (250, 7250)
    assert (sam["used"], sam["remaining"]) == (7400, 100)


def test_different_company_uses_its_own_policy():
    lee = profiles().employee("demo-c-lee").benefits(AS_OF)
    assert lee["plan_id"] == "C2"
    assert (lee["annual_maximum"], lee["used"], lee["remaining"]) == (12000, 500, 11500)
    assert lee["demo_data"] is True


def test_usage_is_counted_in_the_applicable_year():
    assert profiles().employee("demo-a-pat").benefits(date(2027, 1, 1))["used"] == 0


def test_unknown_employee_does_not_fall_back():
    with pytest.raises(KeyError):
        profiles().employee("missing")


def test_canonical_team_policy_references_resolve(tmp_path):
    data = json.loads((Path(__file__).parents[1] / "fixtures/demo.json").read_text())
    data["companies"][0]["plan_id"] = "C0"
    data["companies"][1]["plan_id"] = "C2"
    path = tmp_path / "canonical.json"
    path.write_text(json.dumps(data))
    assert profiles(path).employee("demo-a-pat").benefits(AS_OF)["remaining"] == 7250


@pytest.mark.parametrize("mutation", [
    lambda d: d["companies"].append(d["companies"][0]),
    lambda d: d["companies"][0].update(plan_id=999),
    lambda d: d["companies"][0].update(plan_id=True),
    lambda d: d["companies"][0].update(plan_id=0),
    lambda d: d["companies"][0].update(plan_id="C999"),
    lambda d: d["employees"].append(d["employees"][0]),
    lambda d: d["employees"][0].update(company_id="missing"),
    lambda d: d["employees"][0].update(member_type="not-a-member"),
    lambda d: d["employees"][0]["usage"][0].update(plan_pays_cents=-1),
    lambda d: d["employees"][0]["usage"][0].update(plan_pays_cents=1.5),
    lambda d: d["employees"][0]["usage"][0].update(plan_pays_cents=True),
    lambda d: d["employees"][0]["usage"][0].update(date="2026-02-30"),
    lambda d: d["employees"][0]["usage"][0].update(procedure_id="made-up"),
    lambda d: d["employees"][0]["usage"][0].update(network="unknown"),
    lambda d: d["employees"][0]["usage"][0].update(plan_pays_cents=750001),
])
def test_invalid_fixture_is_rejected(tmp_path, mutation):
    # Validate real parsing; do not replace the policy adapter or calculator.
    data = json.loads((Path(__file__).parents[1] / "fixtures/demo.json").read_text())
    mutation(data)
    path = tmp_path / "bad.json"
    path.write_text(json.dumps(data))
    with pytest.raises(ValueError):
        profiles(path)
