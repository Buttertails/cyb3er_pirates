"""The two reminder email campaigns.

* ``InactivityCampaign``: 90 full days since the last recorded sign-in; one
  email per inactivity cycle.
* ``BenefitsCampaign``: early in the last quarter of the plan year (window opens
  ``lead_months`` before reset), users with at least ``remaining_percent`` of
  the annual maximum left; one email per plan year.

Each campaign lists candidates, rechecks a candidate against fresh data inside
the claim transaction, and renders its email. Benefit figures come from the
shared engine (constitution principle II) and never appear in the email.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime, time, timezone
from typing import Iterator, Optional

from company_employees import COMPANY_EMPLOYEES, employee_id_for_company
from completed_care import with_confirmed_usage
from dental import engine
from dental.mock_plans import UNLIMITED_ANNUAL_MAX_CENTS
from dental.models import UserProfile
from email_delivery import EmailMessage, benefits_email, inactivity_email
from reminders import INACTIVITY_PERIOD, ReminderCandidate, is_inactive, utc

DEFAULT_LEAD_MONTHS = 3
DEFAULT_REMAINING_PERCENT = 90


class InactivityCampaign:
    name = "inactivity"

    def candidates(self, repository, now: datetime) -> Iterator[ReminderCandidate]:
        for profile in repository.inactive_profiles(now - INACTIVITY_PERIOD):
            if profile.inactivity_cycle_id and is_inactive(profile.last_sign_in_at, now):
                yield ReminderCandidate(self.name, profile.uid, profile.inactivity_cycle_id,
                                        eligible_at=utc(profile.last_sign_in_at) + INACTIVITY_PERIOD)

    def care_employee_id(self, profile: Optional[UserProfile]) -> Optional[str]:
        return None

    def recheck(self, profile: Optional[UserProfile], reports, candidate: ReminderCandidate,
                now: datetime) -> bool:
        return (profile is not None and profile.inactivity_cycle_id == candidate.key
                and is_inactive(profile.last_sign_in_at, now))

    def message(self, candidate: ReminderCandidate, sign_in_url: str) -> EmailMessage:
        return inactivity_email(sign_in_url)


@dataclass(frozen=True)
class BenefitsStanding:
    plan_year_start: date
    resets_on: date
    window_opens_on: date
    annual_maximum_cents: int
    used_cents: int

    @property
    def unlimited(self) -> bool:
        return self.annual_maximum_cents >= UNLIMITED_ANNUAL_MAX_CENTS

    @property
    def plan_year_label(self) -> str:
        if (self.plan_year_start.month, self.plan_year_start.day) == (1, 1):
            return str(self.plan_year_start.year)
        return f"{self.plan_year_start.year}–{self.resets_on.year}"


def benefits_standing(employee, reports, as_of: date,
                      lead_months: int = DEFAULT_LEAD_MONTHS) -> BenefitsStanding:
    """Plan-year usage from fixture usage plus confirmed care, via the engine."""
    window = engine.plan_year_window(employee.plan, as_of)
    opens_on, _ = engine.unused_benefits_window(employee.plan, as_of, lead_months)
    usage = with_confirmed_usage(employee, reports or []).usage
    return BenefitsStanding(window[0], window[1], opens_on, employee.plan.annual_maximum_cents,
                            engine.annual_max_used_cents(usage, window))


def qualifies_for_benefits_reminder(standing: BenefitsStanding, as_of: date,
                                    remaining_percent: int = DEFAULT_REMAINING_PERCENT) -> bool:
    maximum = standing.annual_maximum_cents
    if standing.unlimited or maximum <= 0:
        return False
    if not standing.window_opens_on <= as_of < standing.resets_on:
        return False
    return (maximum - standing.used_cents) * 100 >= remaining_percent * maximum


class BenefitsCampaign:
    name = "benefits"

    def __init__(self, profiles, *, lead_months: int = DEFAULT_LEAD_MONTHS,
                 remaining_percent: int = DEFAULT_REMAINING_PERCENT):
        self.profiles = profiles
        self.lead_months = lead_months
        self.remaining_percent = remaining_percent

    def _employee(self, employee_id: Optional[str]):
        return self.profiles.employees.get(employee_id) if employee_id else None

    def _standing(self, employee, reports, as_of: date) -> BenefitsStanding:
        return benefits_standing(employee, reports, as_of, self.lead_months)

    def _any_window_open(self, as_of: date) -> bool:
        for employee_id in set(COMPANY_EMPLOYEES.values()):
            employee = self._employee(employee_id)
            if employee is None:
                continue
            opens_on, resets_on = engine.unused_benefits_window(employee.plan, as_of, self.lead_months)
            if opens_on <= as_of < resets_on:
                return True
        return False

    def candidates(self, repository, now: datetime) -> Iterator[ReminderCandidate]:
        as_of = utc(now).date()
        if not self._any_window_open(as_of):
            return
        for profile in repository.company_profiles(list(COMPANY_EMPLOYEES)):
            employee_id = employee_id_for_company(profile.company)
            employee = self._employee(employee_id)
            if employee is None:
                continue
            standing = self._standing(employee, repository.care_reports(profile.uid, employee_id), as_of)
            if not qualifies_for_benefits_reminder(standing, as_of, self.remaining_percent):
                continue
            yield ReminderCandidate(
                self.name, profile.uid, standing.plan_year_start.isoformat(),
                eligible_at=datetime.combine(standing.window_opens_on, time(), timezone.utc),
                employee_id=employee_id, plan_year_label=standing.plan_year_label,
                resets_on=standing.resets_on)

    def care_employee_id(self, profile: Optional[UserProfile]) -> Optional[str]:
        return employee_id_for_company(profile.company) if profile is not None else None

    def recheck(self, profile: Optional[UserProfile], reports, candidate: ReminderCandidate,
                now: datetime) -> bool:
        if profile is None:
            return False
        employee_id = employee_id_for_company(profile.company)
        employee = self._employee(employee_id)
        if employee is None or employee_id != candidate.employee_id:
            return False
        as_of = utc(now).date()
        standing = self._standing(employee, reports, as_of)
        return (standing.plan_year_start.isoformat() == candidate.key
                and qualifies_for_benefits_reminder(standing, as_of, self.remaining_percent))

    def message(self, candidate: ReminderCandidate, sign_in_url: str) -> EmailMessage:
        return benefits_email(sign_in_url, plan_year_label=candidate.plan_year_label,
                              resets_on=candidate.resets_on)
