"""Cross-plan-year sequencing optimizer.

The valuable insight behind the Optimizer: the annual maximum is use-it-or-lose-it
and resets each plan year. When an employee needs more total care than the
remaining annual max can cover, splitting procedures across the plan-year
boundary gives them a *fresh* annual max — often lowering their out-of-pocket.

This module decides which procedures to do in the current plan year vs. after
the reset, and explains the recommendation in plain language. It reuses
``engine.estimate`` so the coverage math is identical to a single-visit estimate.

It is a heuristic optimizer, not a solver: for the small procedure counts a
person realistically plans (a handful), it greedily fills the current year with
the procedures that extract the most plan payment per dollar of annual max,
then defers the rest. This matches how a benefits advisor would reason.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date
from typing import Any, Optional

from . import catalog, engine
from .models import Category, EmployerPlan, Network, UsageRecord, to_dollars


# Urgency ordering derived from the frontend timeframe IDs. Procedures the user
# flagged as urgent should not be deferred across a plan-year boundary.
URGENT_TIMEFRAMES = {"asap", "two-weeks"}


@dataclass
class ScheduledProcedure:
    procedure_id: str
    label: str
    plan_year_label: str          # "this_year" or "next_year"
    plan_pays_cents: int
    employee_owes_cents: int
    reasons: list[str] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        return {
            "procedure_id": self.procedure_id,
            "label": self.label,
            "when": self.plan_year_label,
            "plan_pays": to_dollars(self.plan_pays_cents),
            "employee_owes": to_dollars(self.employee_owes_cents),
            "reasons": list(self.reasons),
        }


def _employee_owes_if_all_now(
    plan: EmployerPlan,
    usage: list[UsageRecord],
    procedure_ids: list[str],
    network: Network,
    as_of: date,
    enrollment_date: Optional[str],
) -> int:
    est = engine.estimate(
        plan, usage, procedure_ids,
        network=network, as_of=as_of, enrollment_date=enrollment_date,
    )
    return est.total_employee_owes_cents


def optimize_sequence(
    plan: EmployerPlan,
    usage: list[UsageRecord],
    procedure_ids: list[str],
    *,
    network: Network = Network.IN_NETWORK,
    as_of: Optional[date] = None,
    enrollment_date: Optional[str] = None,
    urgent_procedure_ids: Optional[set[str]] = None,
) -> dict[str, Any]:
    """Recommend when to do each procedure to minimize employee out-of-pocket.

    Strategy
    --------
    1. Procedures flagged urgent (or preventive/basic) are always scheduled
       this year — you don't defer a cleaning or an urgent problem to save money.
    2. The remaining discretionary major work is sorted by cost (descending) and
       we evaluate every "split point": do the first k major procedures this year
       and defer the rest to next plan year (which gets a fresh annual maximum).
       We cost each candidate split with the real estimate engine and keep the
       one with the lowest total employee cost.
    3. We only recommend splitting when it actually beats doing everything now.
    """
    as_of = as_of or date.today()
    urgent = set(urgent_procedure_ids or set())

    window = engine.plan_year_window(plan, as_of)
    next_year_as_of = window[1]  # first day of the next plan year

    used_before = engine.annual_max_used_cents(usage, window)
    remaining_max = max(0, plan.annual_maximum_cents - used_before)

    # Classify procedures.
    must_do_now: list[str] = []
    deferrable: list[str] = []
    for pid in procedure_ids:
        entry = catalog.get_procedure(pid)
        if entry is None:
            must_do_now.append(pid)  # unknown: let the estimate flag it
            continue
        is_urgent = pid in urgent
        is_preventive = entry.category == Category.PREVENTIVE
        is_major = entry.category in (Category.MAJOR, Category.ORTHODONTIC)
        if is_urgent or is_preventive or not is_major:
            # Urgent, preventive, or basic care: do it now.
            must_do_now.append(pid)
        else:
            deferrable.append(pid)

    # Sort deferrable major work by allowed cost descending — spend this year's
    # remaining max on the most expensive items first for the biggest payout.
    def allowed(pid: str) -> int:
        entry = catalog.get_procedure(pid)
        return engine.allowed_amount_cents(plan, entry, network) if entry else 0

    deferrable.sort(key=allowed, reverse=True)

    def cost_of_split(num_this_year: int) -> tuple[int, "engine.Estimate", "engine.Estimate", list[str], list[str]]:
        """Employee cost if the first ``num_this_year`` deferrable majors are done
        now (alongside all must-do-now work) and the rest are deferred.

        Returns (total_owed_cents, this_year_estimate, next_year_estimate,
        this_year_ids, next_year_ids).
        """
        this_ids = list(must_do_now) + deferrable[:num_this_year]
        next_ids = deferrable[num_this_year:]
        this_est = engine.estimate(
            plan, usage, this_ids,
            network=network, as_of=as_of, enrollment_date=enrollment_date,
        )
        # Deferred procedures start a fresh plan year with no prior usage.
        next_est = engine.estimate(
            plan, [], next_ids,
            network=network, as_of=next_year_as_of, enrollment_date=enrollment_date,
        )
        total = this_est.total_employee_owes_cents + next_est.total_employee_owes_cents
        return total, this_est, next_est, this_ids, next_ids

    # Baseline: everything in the current plan year (defer nothing).
    baseline_owes, _, _, _, _ = cost_of_split(len(deferrable))

    # Evaluate every split point and keep the cheapest for the employee.
    best_owes = baseline_owes
    best_k = len(deferrable)
    for k in range(len(deferrable) - 1, -1, -1):
        owes, _, _, _, _ = cost_of_split(k)
        if owes < best_owes:
            best_owes = owes
            best_k = k

    _, this_year_est, next_year_est, this_year, next_year = cost_of_split(best_k)
    split_owes = best_owes
    recommend_split = bool(next_year) and split_owes < baseline_owes
    savings = max(0, baseline_owes - split_owes)

    # Build the schedule view.
    scheduled: list[ScheduledProcedure] = []
    by_id_this = {l.procedure_id: l for l in this_year_est.lines}
    for pid in this_year:
        line = by_id_this.get(pid)
        scheduled.append(
            ScheduledProcedure(
                procedure_id=pid,
                label=line.label if line else pid,
                plan_year_label="this_year",
                plan_pays_cents=line.plan_pays_cents if line else 0,
                employee_owes_cents=line.employee_owes_cents if line else 0,
                reasons=line.reasons if line else [],
            )
        )
    if recommend_split:
        by_id_next = {l.procedure_id: l for l in next_year_est.lines}
        for pid in next_year:
            line = by_id_next.get(pid)
            reasons = list(line.reasons) if line else []
            reasons.append(
                f"Deferring to the next plan year (starts {next_year_as_of.isoformat()}) "
                "uses a fresh annual maximum."
            )
            scheduled.append(
                ScheduledProcedure(
                    procedure_id=pid,
                    label=line.label if line else pid,
                    plan_year_label="next_year",
                    plan_pays_cents=line.plan_pays_cents if line else 0,
                    employee_owes_cents=line.employee_owes_cents if line else 0,
                    reasons=reasons,
                )
            )
        summary = (
            f"Splitting your care across the plan year saves about "
            f"${to_dollars(savings)}. Do the highest-value work now while this "
            f"year's maximum lasts, then schedule the rest after "
            f"{next_year_as_of.isoformat()} for a fresh ${to_dollars(plan.annual_maximum_cents)} maximum."
        )
    else:
        # No benefit to splitting (or nothing deferrable): do it all this year.
        scheduled = [
            ScheduledProcedure(
                procedure_id=l.procedure_id,
                label=l.label,
                plan_year_label="this_year",
                plan_pays_cents=l.plan_pays_cents,
                employee_owes_cents=l.employee_owes_cents,
                reasons=l.reasons,
            )
            for l in engine.estimate(
                plan, usage, procedure_ids,
                network=network, as_of=as_of, enrollment_date=enrollment_date,
            ).lines
        ]
        summary = (
            "Doing all of this in the current plan year is your best option — "
            "splitting it across years wouldn't lower your out-of-pocket cost."
        )

    return {
        "as_of": as_of.isoformat(),
        "plan_year": {"start": window[0].isoformat(), "end": window[1].isoformat()},
        "next_plan_year_start": next_year_as_of.isoformat(),
        "annual_maximum": to_dollars(plan.annual_maximum_cents),
        "annual_max_remaining_now": to_dollars(remaining_max),
        "recommend_split": recommend_split,
        "estimated_cost_all_now": to_dollars(baseline_owes),
        "estimated_cost_recommended": to_dollars(
            split_owes if recommend_split else baseline_owes
        ),
        "estimated_savings": to_dollars(savings if recommend_split else 0),
        "schedule": [s.to_dict() for s in scheduled],
        "summary": summary,
    }
