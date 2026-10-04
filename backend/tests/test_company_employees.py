"""The backend company -> fictional employee map mirrors the frontend's."""

import json
import re
from pathlib import Path

import pytest

import company_employees
from chat_profiles import load_profiles

ROOT = Path(__file__).resolve().parents[2]


def frontend_mapping():
    source = (ROOT / "frontend" / "src" / "lib" / "demoEmployees.js").read_text()
    block = re.search(r"COMPANY_EMPLOYEES = \{(.*?)\};", source, re.S).group(1)
    return dict(re.findall(r"'([^']+)':\s*'([^']+)'", block))


def test_mapping_matches_the_frontend():
    assert dict(company_employees.COMPANY_EMPLOYEES) == frontend_mapping()


def test_every_mapped_employee_exists_and_uses_the_directory_plan():
    profiles = load_profiles()
    company_plans = json.loads((ROOT / "backend" / "fixtures" / "dentists.json").read_text())["company_plans"]
    for company, employee_id in company_employees.COMPANY_EMPLOYEES.items():
        assert profiles.employee(employee_id).plan_id == company_plans[company]


@pytest.mark.parametrize("company", ["other", None, "", "unknown-co", "__proto__"])
def test_unknown_companies_have_no_fallback_employee(company):
    assert company_employees.employee_id_for_company(company) is None


def test_mapping_is_read_only():
    with pytest.raises(TypeError):
        company_employees.COMPANY_EMPLOYEES["new-co"] = "demo-a-pat"
