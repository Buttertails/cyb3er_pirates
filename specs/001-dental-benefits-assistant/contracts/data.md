# JSON Data Contract

**Purpose**: Agree the common shape for collaborator data before implementation.
**Version**: 1
**Authority**: [data-model.md](../data-model.md)

## Canonical Shape

| Collection | Required information |
| --- | --- |
| Root | schema_version, fixture_set_id, companies, employees, procedures |
| Company | id, name, one nested plan |
| Plan | id, name, annual_max_cents, reset_month, reset_day, summary, coverage |
| Employee | id, name, company_id, baseline_usage entries |
| Baseline usage entry | period_start, insurer_paid_cents |
| Procedure | id, name, aliases, category, description, prices_cents |

Coverage is a category-to-network mapping of numeric fractions.
Prices are a network mapping of integer cents.
Dates are YYYY-MM-DD. Coverage 50% is represented as 0.5.
Money $1,500 is represented as 150000 cents.

## Incoming JSON Mapping

The incoming collaborator shape is still unknown. Future implementation must
inspect it, document mappings in `docs/json-data-mapping.md`, and normalize it
into this common representation. Do not change shared calculations per company.

The mapper may rename fields and explicitly convert documented dollar amounts
or percentages. It must not guess units, company relationships, missing rates,
or usage amounts. Reject malformed or ambiguous input with field-level messages.
Unknown network data stays unavailable.

Company and procedure JSON is the policy/price source. Employee and baseline
entries are seed inputs for Firestore, not an independently writable runtime
user store. Import is idempotent and preserves confirmed reports.

Initial representative fixtures must contain at least two different company
plans, employees with different usage (including two within one company), and
cleaning, filling, and crown prices. These are proposed demo examples, not
claims about the incoming data.

For repeatable isolated tests, use these proposed crown scenarios:

| Company / employee | Allowance cents | Used cents | In-network crown coverage |
| --- | --- | --- | --- |
| Northstar / Alex | 150000 | 100000 | 0.5 |
| Northstar / Taylor | 150000 | 130000 | 0.5 |
| Harbor / Morgan | 200000 | 80000 | 0.8 |

With a 120000-cent in-network crown, insurer/employee shares are 50000/70000,
20000/100000, and 96000/24000 respectively. Alex's next-period comparison with
zero usage is 60000/60000. These are fictional test inputs; incoming data may
replace the displayed demo examples without changing the calculation rules.

## Replacement and Validation

JSON replacement is the initial employer policy maintenance mechanism. Validate
the entire replacement and restart the demo. Use a new fixture-set identity for
an incompatible baseline or policy replacement so historical reports are not
silently reinterpreted. An editing interface is deferred.

All constraints in the data model are enforced before serving data. Invalid
fixtures fail startup with actionable validation output; they are never partly
accepted. This contract may be amended after the incoming JSON is reviewed,
through Spec Kit before affected implementation.
