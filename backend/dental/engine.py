"""Deterministic coverage/cost engine for the Dental Benefits Optimizer.

Everything here is a pure function of its inputs: give it a plan, the employee's
usage ledger, and the procedure(s) they want, and it returns exactly what the
plan pays and what the employee owes — plus the bonus features (annual-max
tracking, in/out-of-network comparison, and end-of-year reminders).

No Firestore, no network, no clocks except an explicitly passed ``as_of`` date,
so results are reproducible and unit-testable.

Core calculation order (matches how real dental claims adjudicate):
    1. Determine the allowed amount (fee schedule or catalog typical cost).
    2. Enforce eligibility: waiting periods and frequency limits.
    3. Apply the remaining deductible (unless the category is exempt).
    4. Apply the plan's coverage rate for the category/network.
    5. Cap the plan's payment at the remaining annual maximum.
    6. Whatever the plan doesn't pay, the employee owes.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date
from typing import Any, Iterable, Optional

from . import catalog
from .models import (
    Category,
    EmployerPlan,
    Network,
    ProcedureCatalogEntry,
    UsageRecord,
    to_dollars,
)


# --------------------------------------------------------------------------- #
# Date / plan-year helpers
# --------------------------------------------------------------------------- #

def _parse_date(value: str | date) -> date:
    if isinstance(value, date):
        return value
    return date.fromisoformat(value)


def plan_year_window(plan: EmployerPlan, as_of: date) -> tuple[date, date]:
    """Return [start, end) of the plan year that contains ``as_of``.

    For a Jan 1 plan and as_of in 2026, this is 2026-01-01 .. 2027-01-01.
    For a July 1 fiscal plan, as_of 2026-03 falls in the 2025-07-01 window.
    """
    start_month = plan.plan_year_start_month
    start_day = plan.plan_year_start_day
    # Candidate start in the same calendar year as as_of.
    candidate = date(as_of.year, start_month, start_day)
    if as_of >= candidate:
        start = candidate
    else:
        start = date(as_of.year - 1, start_month, start_day)
    # End is one year later (exclusive).
    try:
        end = date(start.year + 1, start_month, start_day)
    except ValueError:  # Feb 29 edge — fall back to Mar 1
        end = date(start.year + 1, start_month, start_day + 1)
    return start, end


def unused_benefits_window(plan: EmployerPlan, as_of: date, lead_months: int = 3) -> tuple[date, date]:
    """Return (opens_on, resets_on) for the "use your benefits" reminder.

    The window opens ``lead_months`` before the plan year containing ``as_of``
    ends (Oct 1 for a calendar-year plan with the default lead) and closes when
    benefits reset. The day of month is clamped for short months.
    """
    _start, resets_on = plan_year_window(plan, as_of)
    month_index = resets_on.year * 12 + (resets_on.month - 1) - lead_months
    year, month = divmod(month_index, 12)
    month += 1
    for day in range(resets_on.day, 27, -1):
        try:
            return date(year, month, day), resets_on
        except ValueError:
            continue
    return date(year, month, min(resets_on.day, 28)), resets_on


def _months_between(earlier: date, later: date) -> int:
    """Whole months from ``earlier`` to ``later`` (0 if later is before)."""
    if later < earlier:
        return 0
    months = (later.year - earlier.year) * 12 + (later.month - earlier.month)
    if later.day < earlier.day:
        months -= 1
    return max(0, months)


# --------------------------------------------------------------------------- #
# Usage summaries (feeds annual-max tracking + frequency checks)
# --------------------------------------------------------------------------- #

def usage_in_window(
    usage: Iterable[UsageRecord], window: tuple[date, date]
) -> list[UsageRecord]:
    start, end = window
    result = []
    for u in usage:
        d = _parse_date(u.date)
        if start <= d < end:
            result.append(u)
    return result


def annual_max_used_cents(
    usage: Iterable[UsageRecord], window: tuple[date, date]
) -> int:
    """Sum of plan payments within the plan year — what counts against the max."""
    return sum(u.plan_pays_cents for u in usage_in_window(usage, window))


def procedure_count_in_window(
    usage: Iterable[UsageRecord], procedure_id: str, window: tuple[date, date]
) -> int:
    return sum(
        1 for u in usage_in_window(usage, window) if u.procedure_id == procedure_id
    )


# --------------------------------------------------------------------------- #
# Result types
# --------------------------------------------------------------------------- #

@dataclass
class EstimateLine:
    """The coverage breakdown for a single requested procedure."""

    procedure_id: str
    label: str
    category: str
    network: str
    allowed_amount_cents: int
    deductible_applied_cents: int
    plan_pays_cents: int
    employee_owes_cents: int
    coverage_rate: float
    covered: bool
    reasons: list[str] = field(default_factory=list)  # why blocked / notes

    def to_dict(self) -> dict[str, Any]:
        return {
            "procedure_id": self.procedure_id,
            "label": self.label,
            "category": self.category,
            "network": self.network,
            "allowed_amount": to_dollars(self.allowed_amount_cents),
            "deductible_applied": to_dollars(self.deductible_applied_cents),
            "plan_pays": to_dollars(self.plan_pays_cents),
            "employee_owes": to_dollars(self.employee_owes_cents),
            "coverage_rate": self.coverage_rate,
            "covered": self.covered,
            "reasons": list(self.reasons),
        }


@dataclass
class Estimate:
    """The full estimate for one or more procedures in a single plan year."""

    lines: list[EstimateLine]
    plan_year_start: str
    plan_year_end: str
    annual_maximum_cents: int
    annual_max_used_before_cents: int
    annual_max_used_after_cents: int
    deductible_cents: int
    deductible_used_before_cents: int

    @property
    def total_plan_pays_cents(self) -> int:
        return sum(l.plan_pays_cents for l in self.lines)

    @property
    def total_employee_owes_cents(self) -> int:
        return sum(l.employee_owes_cents for l in self.lines)

    def to_dict(self) -> dict[str, Any]:
        return {
            "lines": [l.to_dict() for l in self.lines],
            "plan_year": {"start": self.plan_year_start, "end": self.plan_year_end},
            "annual_maximum": to_dollars(self.annual_maximum_cents),
            "annual_max_used_before": to_dollars(self.annual_max_used_before_cents),
            "annual_max_used_after": to_dollars(self.annual_max_used_after_cents),
            "annual_max_remaining_after": to_dollars(
                max(0, self.annual_maximum_cents - self.annual_max_used_after_cents)
            ),
            "deductible": to_dollars(self.deductible_cents),
            "deductible_used_before": to_dollars(self.deductible_used_before_cents),
            "totals": {
                "plan_pays": to_dollars(self.total_plan_pays_cents),
                "employee_owes": to_dollars(self.total_employee_owes_cents),
            },
        }


# --------------------------------------------------------------------------- #
# Allowed amount + eligibility
# --------------------------------------------------------------------------- #

def allowed_amount_cents(
    plan: EmployerPlan,
    entry: ProcedureCatalogEntry,
    network: Network,
) -> int:
    """The amount the claim is adjudicated against: fee schedule overrides catalog."""
    schedule = (
        plan.fee_schedule_in_network
        if network == Network.IN_NETWORK
        else plan.fee_schedule_out_network
    )
    if entry.id in schedule:
        return schedule[entry.id]
    return (
        entry.typical_cost_in_network_cents
        if network == Network.IN_NETWORK
        else entry.typical_cost_out_network_cents
    )


def _coverage_rate(plan: EmployerPlan, category: Category, network: Network) -> float:
    tier = plan.tier_for(category)
    if tier is None:
        return 0.0
    return tier.in_network_rate if network == Network.IN_NETWORK else tier.out_network_rate


def check_eligibility(
    plan: EmployerPlan,
    entry: ProcedureCatalogEntry,
    usage: Iterable[UsageRecord],
    window: tuple[date, date],
    enrollment_date: Optional[str],
    as_of: date,
) -> list[str]:
    """Return a list of blocking reasons. Empty list == eligible.

    Checks waiting periods (relative to enrollment) and frequency limits
    (per_year and per_months).
    """
    reasons: list[str] = []

    # Waiting period for the category.
    tier = plan.tier_for(entry.category)
    if tier and tier.waiting_period_months > 0 and enrollment_date:
        enrolled = _parse_date(enrollment_date)
        months_enrolled = _months_between(enrolled, as_of)
        if months_enrolled < tier.waiting_period_months:
            remaining = tier.waiting_period_months - months_enrolled
            reasons.append(
                f"{entry.category.value.title()} care has a "
                f"{tier.waiting_period_months}-month waiting period; "
                f"{remaining} month(s) remaining."
            )

    # Frequency limits.
    limit = plan.frequency_limit_for(entry.id)
    if limit:
        if limit.per_year is not None:
            used = procedure_count_in_window(usage, entry.id, window)
            if used >= limit.per_year:
                reasons.append(
                    f"Frequency limit reached: {limit.per_year} per plan year "
                    f"({used} already used)."
                )
        if limit.per_months is not None:
            # Find the most recent same-procedure usage and check the interval.
            most_recent: Optional[date] = None
            for u in usage:
                if u.procedure_id == entry.id:
                    d = _parse_date(u.date)
                    if most_recent is None or d > most_recent:
                        most_recent = d
            if most_recent is not None:
                gap = _months_between(most_recent, as_of)
                if gap < limit.per_months:
                    reasons.append(
                        f"Covered once every {limit.per_months} months; last done "
                        f"{gap} month(s) ago."
                    )
    return reasons


# --------------------------------------------------------------------------- #
# Core estimate
# --------------------------------------------------------------------------- #

def estimate(
    plan: EmployerPlan,
    usage: list[UsageRecord],
    procedure_ids: list[str],
    *,
    network: Network = Network.IN_NETWORK,
    as_of: Optional[date] = None,
    enrollment_date: Optional[str] = None,
    deductible_used_cents: int = 0,
) -> Estimate:
    """Estimate coverage and cost for one or more procedures in the current plan year.

    Procedures are processed in the order given; the deductible and annual
    maximum are consumed cumulatively across the list, mirroring how a sequence
    of visits in the same year would actually adjudicate.
    """
    as_of = as_of or date.today()
    window = plan_year_window(plan, as_of)

    used_before = annual_max_used_cents(usage, window)
    remaining_max = max(0, plan.annual_maximum_cents - used_before)
    remaining_deductible = max(0, plan.individual_deductible_cents - deductible_used_cents)

    lines: list[EstimateLine] = []
    # Simulate accumulating usage as we process each requested procedure, so
    # frequency limits account for earlier procedures in the same request.
    running_usage = list(usage)

    for pid in procedure_ids:
        entry = catalog.get_procedure(pid)
        if entry is None:
            lines.append(
                EstimateLine(
                    procedure_id=pid,
                    label=pid,
                    category="unknown",
                    network=network.value,
                    allowed_amount_cents=0,
                    deductible_applied_cents=0,
                    plan_pays_cents=0,
                    employee_owes_cents=0,
                    coverage_rate=0.0,
                    covered=False,
                    reasons=["Unknown procedure; not in catalog."],
                )
            )
            continue

        allowed = allowed_amount_cents(plan, entry, network)
        rate = _coverage_rate(plan, entry.category, network)
        reasons = check_eligibility(
            plan, entry, running_usage, window, enrollment_date, as_of
        )

        if reasons or rate <= 0:
            if rate <= 0 and not reasons:
                reasons.append(
                    f"{entry.category.value.title()} services are not covered by this plan."
                )
            # Not covered: employee pays the full allowed amount, plan pays 0.
            lines.append(
                EstimateLine(
                    procedure_id=pid,
                    label=entry.label,
                    category=entry.category.value,
                    network=network.value,
                    allowed_amount_cents=allowed,
                    deductible_applied_cents=0,
                    plan_pays_cents=0,
                    employee_owes_cents=allowed,
                    coverage_rate=rate,
                    covered=False,
                    reasons=reasons,
                )
            )
            continue

        # Apply remaining deductible first (unless exempt for preventive).
        deductible_applied = 0
        exempt = (
            entry.category == Category.PREVENTIVE
            and not plan.deductible_applies_to_preventive
        )
        amount_after_deductible = allowed
        if not exempt and remaining_deductible > 0:
            deductible_applied = min(remaining_deductible, allowed)
            remaining_deductible -= deductible_applied
            amount_after_deductible = allowed - deductible_applied

        # Plan pays its coverage rate of the post-deductible amount...
        plan_pays = int(round(amount_after_deductible * rate))
        # ...capped at the remaining annual maximum.
        if plan_pays > remaining_max:
            plan_pays = remaining_max
        remaining_max -= plan_pays

        employee_owes = allowed - plan_pays

        notes: list[str] = []
        if plan_pays == 0 and remaining_max == 0:
            notes.append("Annual maximum exhausted; plan pays $0 for this service.")
        if deductible_applied > 0:
            notes.append(
                f"Deductible of {to_dollars(deductible_applied)} applied before coverage."
            )

        lines.append(
            EstimateLine(
                procedure_id=pid,
                label=entry.label,
                category=entry.category.value,
                network=network.value,
                allowed_amount_cents=allowed,
                deductible_applied_cents=deductible_applied,
                plan_pays_cents=plan_pays,
                employee_owes_cents=employee_owes,
                coverage_rate=rate,
                covered=True,
                reasons=notes,
            )
        )

        # Record this procedure in the running usage so a repeated procedure in
        # the same request correctly trips frequency limits.
        running_usage.append(
            UsageRecord(
                id=f"__sim_{pid}_{len(running_usage)}",
                procedure_id=pid,
                date=as_of.isoformat(),
                plan_pays_cents=plan_pays,
                employee_paid_cents=employee_owes,
                category=entry.category.value,
                network=network.value,
            )
        )

    used_after = used_before + sum(l.plan_pays_cents for l in lines)

    return Estimate(
        lines=lines,
        plan_year_start=window[0].isoformat(),
        plan_year_end=window[1].isoformat(),
        annual_maximum_cents=plan.annual_maximum_cents,
        annual_max_used_before_cents=used_before,
        annual_max_used_after_cents=used_after,
        deductible_cents=plan.individual_deductible_cents,
        deductible_used_before_cents=deductible_used_cents,
    )


# --------------------------------------------------------------------------- #
# BONUS 1 — Annual maximum usage tracking
# --------------------------------------------------------------------------- #

def annual_max_summary(
    plan: EmployerPlan, usage: list[UsageRecord], as_of: Optional[date] = None
) -> dict[str, Any]:
    """How much of the annual maximum is used, remaining, and the % consumed."""
    as_of = as_of or date.today()
    window = plan_year_window(plan, as_of)
    used = annual_max_used_cents(usage, window)
    total = plan.annual_maximum_cents
    remaining = max(0, total - used)
    pct = round((used / total) * 100, 1) if total > 0 else 0.0
    return {
        "plan_year": {"start": window[0].isoformat(), "end": window[1].isoformat()},
        "annual_maximum": to_dollars(total),
        "used": to_dollars(used),
        "remaining": to_dollars(remaining),
        "percent_used": pct,
        "as_of": as_of.isoformat(),
    }


# --------------------------------------------------------------------------- #
# BONUS 2 — In-network vs out-of-network comparison
# --------------------------------------------------------------------------- #

def compare_networks(
    plan: EmployerPlan,
    usage: list[UsageRecord],
    procedure_ids: list[str],
    *,
    as_of: Optional[date] = None,
    enrollment_date: Optional[str] = None,
    deductible_used_cents: int = 0,
) -> dict[str, Any]:
    """Run the estimate both in- and out-of-network and show the difference."""
    in_est = estimate(
        plan, usage, procedure_ids,
        network=Network.IN_NETWORK, as_of=as_of,
        enrollment_date=enrollment_date, deductible_used_cents=deductible_used_cents,
    )
    out_est = estimate(
        plan, usage, procedure_ids,
        network=Network.OUT_OF_NETWORK, as_of=as_of,
        enrollment_date=enrollment_date, deductible_used_cents=deductible_used_cents,
    )
    savings = out_est.total_employee_owes_cents - in_est.total_employee_owes_cents
    return {
        "in_network": in_est.to_dict(),
        "out_of_network": out_est.to_dict(),
        "employee_savings_in_network": to_dollars(max(0, savings)),
        "recommendation": (
            "Staying in-network saves "
            f"${to_dollars(max(0, savings))} on these procedures."
            if savings > 0
            else "In-network and out-of-network cost about the same here."
        ),
    }


# --------------------------------------------------------------------------- #
# BONUS 3 — End-of-year unused benefit reminders
# --------------------------------------------------------------------------- #

def end_of_year_reminders(
    plan: EmployerPlan,
    usage: list[UsageRecord],
    *,
    as_of: Optional[date] = None,
    reminder_window_days: int = 90,
) -> dict[str, Any]:
    """Flag unused benefits that expire at plan-year reset.

    Returns reminders when the plan year ends within ``reminder_window_days``,
    covering (a) unused annual maximum and (b) unused preventive frequency
    allowances (e.g. a second cleaning not yet taken).
    """
    as_of = as_of or date.today()
    window = plan_year_window(plan, as_of)
    _, end = window
    days_left = (end - as_of).days

    reminders: list[str] = []
    summary = annual_max_summary(plan, usage, as_of)

    within_window = 0 <= days_left <= reminder_window_days

    if within_window:
        remaining = plan.annual_maximum_cents - annual_max_used_cents(usage, window)
        if remaining > 0:
            reminders.append(
                f"You have ${to_dollars(remaining)} of annual maximum left that "
                f"resets in {days_left} days. Consider scheduling needed care before then."
            )
        # Unused preventive frequency allowances (use-it-or-lose-it visits).
        for limit in plan.frequency_limits:
            if limit.per_year:
                entry = catalog.get_procedure(limit.procedure_id)
                if entry and entry.category == Category.PREVENTIVE:
                    used = procedure_count_in_window(usage, limit.procedure_id, window)
                    if used < limit.per_year:
                        reminders.append(
                            f"You've used {used} of {limit.per_year} covered "
                            f"{entry.label.lower()} visits this year."
                        )

    return {
        "as_of": as_of.isoformat(),
        "plan_year_end": end.isoformat(),
        "days_until_reset": days_left,
        "within_reminder_window": within_window,
        "annual_max": summary,
        "reminders": reminders,
    }
