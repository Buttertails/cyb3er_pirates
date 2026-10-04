# Data model

- Fixture set: nonempty version ID, companies array and employees array.
- Company: unique nonempty id/name, exactly one prefixed string plan_id (`C0`, `C2`) resolving to the
  existing policy file. Reject booleans and bare numeric IDs.
- Employee: unique nonempty id/name, resolvable company_id, member_type adult or
  children offered by the company plan, optional ISO enrollment_date, usage list.
- Usage: unique nonempty id, supported procedure_id, ISO date, integer >= 0
  plan_pays_cents and employee_paid_cents, valid network. Current-period totals
  must not exceed the plan maximum. This adapter never writes these records.
- Session reference: version 1, employee_id, fixture_set_id, UUID hex CX session
  ID, issued_at and expires_at integers. HMAC covers the entire encoded reference.
  Maximum token length 2048; expiry is 1800 seconds from creation. Employee and
  fixture versions must match; expiry is rejected at equality.
- Choices: one supported procedure ID, canonical in_network/out_of_network,
  optional ISO treatment_date. Reject malformed or unsupported choices.
- Estimate: unchanged engine.Estimate.to_dict() fields in dollars, plus
  employee/company/plan identity and explicit assumptions in the chat payload.
