# Data model: personalized chatbot

Existing EmployerPlan, UsageRecord and validated DemoProfiles remain the base.
All new fixture records and results carry demo_data=true.

## Treatment case

case_id: opaque server-generated ID; employee_id: validated fixture reference;
procedure_id: supported catalog ID; network: in_network/out_of_network/null;
budget_cents: null or nonnegative integer; preferred_date/deadline: null or valid
YYYY-MM-DD date. No date before displayed reference date; preferred_date after
deadline is invalid. navigation: active step and optional return_to step from
the approved page set. scenario_revision: nonnegative integer. Optional answers
can be skipped. Changing employee requires restart; changing procedure clears
old options/stages/scenario results while retaining general budget/date/network.

## Curated option and stage fixture

option_id: unique nonempty string; source_procedure_id and procedure_id: catalog
references; label and applicability_note: nonempty strings; in/out-network price:
nonnegative integer cents. Prices are trusted server fixture values, never
browser financial overrides. Empty option lists mean no supported alternative.

stage_id: unique within treatment; procedure_id: catalog reference; order:
positive unique integer; in/out-network price: nonnegative integer cents;
earliest_offset_days/latest_offset_days: nonnegative integers, earliest <=
latest. Stages cannot be shuffled or duplicated. Declared stages are separately
modeled services, not arbitrary splits of a full price. Complete baseline stage
sum and dated scenario sums refer to the same services/prices.

rule overrides: company/plan reference and explicit fictional orthodontic lifetime
cap (nonnegative integer cents) when modeled; omission means unknown, not reset.
Relationships and monetary/date/order constraints are validated before use.

## Scenario result and timeline

scenario_id/case_id/revision, employee context, inputs, status ok/unsupported,
reasons, assumptions, baseline and scenario totals, difference, per-year summary,
dated stage lines. All monetary display values originate from integer cents.

Timeline entry: id, date, kind recorded/projected/reset, procedure/stage reference
when relevant, plan_pays and employee_owes, policy-year bounds. Recorded entries
are loaded unchanged from authoritative employee usage. Reset entries carry no
payment. Proposed entries are scratch calculation results only. Restore baseline
replaces projections, never usage. No client financial result is authoritative.

## Signed context

Keep HMAC, expiry, fixture-set ID and CX session binding. Bind verified Firebase
UID to signed demo selection. Case and scenario values are validated on every
turn; forged UID, employee mismatch or changed fixture set rejects context.
Private signing key and webhook token remain at least 32 characters. Retain
existing token version compatibility or return explicit restart on version change.
