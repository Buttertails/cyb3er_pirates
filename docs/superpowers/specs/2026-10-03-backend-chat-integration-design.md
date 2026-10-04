# Backend chat integration

Status: Approved by the user on 2026-10-03. Extends the existing approved dental
assistant design. Backend implementation and tests are authorized; deployment
and live calls remain separate.

## Goal and scope

Make one guided conversation return a real estimate for a selected fictional
employee: procedure → network → estimate, then change a choice and estimate again.
Use the team's existing Flask app in `backend/main.py`, existing procedure
catalog, `Data/plans.json` adapter, and deterministic estimate engine.

The employee's company determines their single plan. Employee usage affects the
remaining annual maximum. Estimates do not record completed care.

## Proposed backend changes

- `POST /api/chat`: Accept `employee_id`, optional `session_id`, and exactly one
  of `text` or a supported start/restart `event`. Call the existing Dialogflow CX
  agent using backend credentials. Return messages, session ID, current page,
  refreshed benefits, and any structured estimate returned by the webhook.
- `POST /api/dialogflow/webhook`: Accept the CX standard webhook format and
  validate a configured authorization header. Handle `benefits.summary` and
  `benefits.estimate`. Resolve company policy and employee usage in Python;
  accept only procedure/network/date choices from the agent. Return plain text
  plus the calculator's structured result.
- Keep these adapters in small backend modules registered with the Flask app.
  Preserve the existing `/estimate` API and its response fields. Public engine
  responses use dollars; engine calculations and usage records use cents.

## Employee data for the first test

`Data/company.json`, `person.json`, and `procedure.json` currently contain
placeholder records. Leave those teammate files intact. Add explicitly fictional
test employees and company-to-plan mappings under `backend/fixtures/`, referencing
the the team’s canonical prefixed plan IDs (`C0`, `C2`). Include two employees at the same company with
different usage and an employee at another company. Reject unknown IDs rather
than selecting a default plan. This is a read-only demo data source; connecting
real profile/usage storage is a later change.

## Cloud-compatible conversation context

The earlier plan assumed a single Python process and in-memory session bindings.
Cloud Functions may route successive calls to different instances. Use a signed,
expiring session reference containing the fictional employee ID and random CX
session ID instead. Reuse it across turns and validate it in both endpoints.
Send it to CX as a backend context parameter. The webhook verifies that it
matches the CX session, then reloads policy and usage from backend data.

The signing key and webhook authorization token are configuration inputs, kept
outside source control and public responses. Missing configuration fails clearly.
This does not create a database or change Firebase Authentication.

## Failure handling and verification

Validate JSON, message length, session ownership/expiry, supported events,
procedure IDs, network values and dates. Unsupported choices ask for correction.
Missing webhook authorization is rejected. Failed CX calls return a recoverable
service error, without fabricated estimates or a local conversation fallback.
Use explicit request deadlines and disable automatic retries of chat turns.

Tests replace the external CX call and exercise real Flask routes, session
validation, webhook fulfillment and the existing calculator. Cover different
company policies, employee usage, changed network choice, forged financial
parameters, expired sessions, authorization failures and service outages.
Run the existing backend suite to check for regressions.

## Delivery boundary

This change covers backend code, tests and canonical spec updates. Frontend
wiring, remote agent configuration, deployment, live paid requests, login,
database provisioning, usage writes and timing comparison are separate work.
A passing mocked conversation demonstrates backend behavior; it does not prove
a working live Dialogflow connection.
