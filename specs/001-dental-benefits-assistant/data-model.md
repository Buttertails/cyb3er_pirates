# Data Model: Dental Benefits Assistant

This is a planning contract; it does not create fixtures or database tables.

## Fixture Set

Root fields: `schema_version` (integer, initially 1), `fixture_set_id` (nonempty
stable string), `companies`, `employees`, and `procedures` arrays.

Policies and prices are read from this set. Employee profiles and baseline
usage are seeded into Firestore once; runtime user data comes from Firestore.
Reports are scoped to the fixture-set identity. Replace the fixture-set identity when unrelated sample data or
usage baselines change; retain it across ordinary restarts. Incompatible policy
or reset-date changes require a fresh dataset identity or explicit migration.

## Company and Plan

A company has `id`, `name`, and exactly one nested `plan`.
A plan has `id`, `name`, `annual_max_cents`, `reset_month`, `reset_day`,
`summary`, and `coverage` by category and network.

- IDs and names are nonempty; company IDs and plan IDs are unique within the set.
- `annual_max_cents` is an integer >= 0; booleans are not monetary integers.
- Reset month/day describe a valid annually recurring date. February 29 is
  excluded from this simplified model.
- Categories are `preventive`, `basic`, and `major`.
- Network keys are `in_network` and optional `out_of_network`.
- Present coverage fractions must be numeric, finite and between 0 and 1.
  Missing coverage means unavailable information, not zero coverage.
- `summary` contains a readable fictional description matching the values.

## Employee and Baseline Usage

An employee has `id`, `name`, `company_id`, and `baseline_usage`.
Each baseline entry has `period_start` (ISO date) and `insurer_paid_cents`.

Employee IDs are unique and every company reference must resolve.
Baseline entries have unique period starts matching the company's reset date.
Amounts must be integers from zero through the plan's annual maximum.
An absent period entry means zero known usage for that period.

Usage belongs to each employee independently. Baseline usage is imported idempotently and not inserted
again when the application restarts. Seeding the same fixture set never resets
existing reported usage.

## Procedure

A procedure has `id`, `name`, `aliases`, `category`, `description`, and
`prices_cents` by network. IDs are unique, categories use the supported set,
and present prices are nonnegative integer cents. At least an in-network price
is required; out-of-network price is optional. Names and aliases support the
guided conversation. They do not define plan coverage.

## Benefit Period

For a treatment date, derive the most recent annual reset on or before that
date. That is `period_start`; the next reset is exclusive `period_end`.
The dashboard uses the period containing the configured reference date.
A following-period comparison uses known usage for that period if present,
otherwise zero, and explicitly states the continuing-plan/price assumption.

## Completed-Care Report (Firestore)

Fields: `submission_id` (unique within fixture set and employee), `fixture_set_id`,
`employee_id`, `procedure_id`, `procedure_date`, `period_start`,
`insurer_paid_cents`, and `created_at`.

- Employee and procedure must resolve to the active fixture set.
- Procedure date must not be later than the configured reference date.
- Reported amount must be a nonnegative integer and cannot make total recorded
  usage exceed the simplified annual maximum for its period.
- The employee enters and confirms the insurer-paid amount; a total bill or an
  uncompleted estimate is not automatically treated as insurance usage.
- Missing amounts require input before submission.
- A retried submission with identical fields returns its prior result; reusing
  an ID with different fields returns a conflict.
- Validate and insert in one transaction. No partial update is allowed.
- Firestore transactions read existing submission and period totals before
  writes; transaction retries have no external side effects. Reports survive
  application restarts. Emulator shutdown retention requires export/import.

Total used = matching baseline + confirmed matching reports.
Remaining = annual maximum - total used. Displayed remaining cannot be negative.
A duplicate or rejected report leaves total usage unchanged.

## Firestore Collections and Import

- `fixture_sets/{fixture_set_id}`: schema version and seed metadata.
- `fixture_sets/{id}/profiles/{employee_id}`: name and company reference.
- `.../profiles/{employee_id}/benefit_periods/{period_start}`: period boundaries,
  baseline_cents and reported_cents; usage is their sum.
- `.../profiles/{employee_id}/submissions/{submission_id}`: confirmed report
  fields and canonical request fingerprint for idempotency.

Validate the full JSON before import. Seeding creates missing records and
checks existing baseline compatibility without overwriting reported totals.
An incompatible fixture replacement uses a new fixture-set identity. The report
transaction creates the submission and increments period totals atomically.
All runtime profile and usage access passes through Python.

## Estimate and Comparison (Derived, Not Stored Usage)

An estimate includes employee/company/plan/procedure identities, treatment date,
network, price, coverage fraction, period, used/remaining values, insurer payment,
employee share, allowance limitation and explanatory assumptions.

Insurer payment = minimum of remaining allowance and price × coverage,
rounded to integer cents with decimal ROUND_HALF_UP.
Employee share = price - insurer payment.
Missing price or coverage yields an unavailable result with the missing reason.

A comparison contains estimates for current and following periods and available
network alternatives for the same single procedure. It never records usage.

## Conversation Context

Python creates a random session UUID and binds it to the selected employee and
fixture set. CX parameters contain procedure/date/network choices, never
authoritative benefit values. Changing profile starts a fresh context and clears
prior estimates. The frontend ignores responses from an obsolete profile/session.
