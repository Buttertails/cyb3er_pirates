"""Validated, read-only fictional employee context for the first chat test."""

from __future__ import annotations

import json
import re
from dataclasses import dataclass
from datetime import date
from pathlib import Path

from dental import catalog, engine, mock_plans
from dental.models import EmployerPlan, Network, UsageRecord

DEFAULT_FIXTURE = Path(__file__).parent / "fixtures" / "demo.json"


def iso_date(value: object) -> date:
    if not isinstance(value, str) or not re.fullmatch(r"\d{4}-\d{2}-\d{2}", value):
        raise ValueError("Use an ISO date in YYYY-MM-DD format.")
    return date.fromisoformat(value)


def _text(value: object) -> str:
    if not isinstance(value, str) or not value.strip():
        raise ValueError("IDs and names must be nonempty strings.")
    return value


def _nonnegative_integer(value: object) -> int:
    if type(value) is not int or value < 0:
        raise ValueError("Usage amounts must be nonnegative integer cents.")
    return value


@dataclass(frozen=True)
class EmployeeContext:
    employee_id: str
    employee_name: str
    company_id: str
    company_name: str
    plan_id: int
    plan: EmployerPlan
    usage: list[UsageRecord]
    enrollment_date: str | None

    def identity(self) -> dict:
        return {
            "employee_id": self.employee_id, "employee_name": self.employee_name,
            "company_id": self.company_id, "company_name": self.company_name,
            "plan_id": self.plan_id, "plan_name": self.plan.name,
        }

    def benefits(self, as_of: date) -> dict:
        return {**self.identity(), **engine.annual_max_summary(self.plan, self.usage, as_of),
                "demo_data": True}


@dataclass(frozen=True)
class DemoProfiles:
    fixture_set_id: str
    employees: dict[str, EmployeeContext]

    def employee(self, employee_id: str) -> EmployeeContext:
        return self.employees[employee_id]


def load_profiles(path: str | Path | None = None, *, as_of: date | None = None) -> DemoProfiles:
    """Reload so separate instances and turns use the current fixture contents."""
    as_of = as_of or date.today()
    try:
        data = json.loads(Path(path or DEFAULT_FIXTURE).read_text())
        fixture_set_id = _text(data["fixture_set_id"])
        policies = mock_plans.load_mock_plans_by_id()
        companies = {}
        for company in data["companies"]:
            cid = _text(company["id"])
            _text(company["name"])
            pid = company["plan_id"]
            if cid in companies or type(pid) is not int or pid not in policies:
                raise ValueError("Duplicate company or invalid company plan reference.")
            companies[cid] = company
        employees = {}
        for employee in data["employees"]:
            eid = _text(employee["id"])
            name = _text(employee["name"])
            if eid in employees or employee["company_id"] not in companies:
                raise ValueError("Duplicate employee or invalid company reference.")
            company = companies[employee["company_id"]]
            plan = policies[company["plan_id"]].to_employer_plan(
                mock_plans.MemberType(employee["member_type"]), employer_id=company["id"])
            enrollment = employee.get("enrollment_date")
            if enrollment is not None:
                iso_date(enrollment)
            usage = []
            usage_ids = set()
            period_totals = {}
            if not isinstance(employee["usage"], list):
                raise ValueError("Usage must be a list.")
            for record in employee["usage"]:
                rid = _text(record["id"])
                if rid in usage_ids or record["procedure_id"] not in catalog.PROCEDURE_CATALOG:
                    raise ValueError("Duplicate usage ID or unsupported procedure.")
                usage_ids.add(rid)
                service_date = iso_date(record["date"])
                paid = _nonnegative_integer(record["plan_pays_cents"])
                _nonnegative_integer(record.get("employee_paid_cents", 0))
                Network(record.get("network", "in_network"))
                period = engine.plan_year_window(plan, service_date)
                period_totals[period] = period_totals.get(period, 0) + paid
                if period_totals[period] > plan.annual_maximum_cents:
                    raise ValueError("Recorded usage exceeds the annual maximum.")
                usage.append(UsageRecord.from_dict(record))
            employees[eid] = EmployeeContext(
                eid, name, company["id"], company["name"], company["plan_id"],
                plan, usage, enrollment)
        if not companies or not employees:
            raise ValueError("Provide at least one company and employee.")
        return DemoProfiles(fixture_set_id, employees)
    except (KeyError, TypeError, AttributeError) as exc:
        raise ValueError("Malformed employee fixture data.") from exc
