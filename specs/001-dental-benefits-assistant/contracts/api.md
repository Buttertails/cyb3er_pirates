# API Contract: Dental Benefits Assistant

Planning only. Routes and DTOs below are future implementation interfaces.

## Conventions

Same origin for website and API. JSON field names use snake_case. Money is integer
cents; dates are ISO YYYY-MM-DD. All estimates are fictional approximations.
Reference date defaults to the backend's current date and may be fixed for
repeatable demonstrations. Only one procedure is supplied per request.

Application errors use `{error: {code, message, fields}}`. Use 404 for unknown
IDs, 409 for conflicting duplicate reports, 422 for invalid input, and 503 for
unavailable conversation service. Unexpected errors return a generic message
and are logged without credentials. Framework validation errors are normalized
to this same envelope.

## GET /api/bootstrap

Returns fixture_set_id, fictional employee choices with company names,
procedure choices, reference_date, and conversation_mode (`dialogflow` or
explicitly selected `local_demo`). Returns no credentials.

## GET /api/employees/{employee_id}/benefits

Returns employee, company, plan name/summary, coverage, current period start/end,
annual_max_cents, used_cents, remaining_cents, and recent report summaries.
Unknown employees return 404.

## POST /api/estimate

Input: employee_id, procedure_id, treatment_date, network.
Network is `in_network` or `out_of_network`; dates may be in the current or
following benefit period. Out-of-range dates return 422 for this initial demo.

Returns an Estimate with identities, period dates, treatment_date, network,
price_cents, coverage_fraction, insurer_paid_cents, employee_paid_cents,
used_cents, remaining_before_cents, remaining_after_cents,
allowance_limited, explanation, and assumptions.

Missing price or coverage returns `{available:false, reason, employee_id,
procedure_id, network}` rather than an invented estimate. Successful estimates
include `available:true`. This route never writes usage.

## POST /api/compare

Input: employee_id, procedure_id, network.
Returns current_period and next_period estimates and the chosen comparison dates:
reference_date and the first day after the current period ends. Include
network_options for both networks at the reference date, with explicit
unavailable entries where data is missing. Include continuing-plan/price and
financial-timing assumptions. This route never writes usage.

## POST /api/usage

Input: employee_id, procedure_id, procedure_date, insurer_paid_cents,
submission_id, confirmed:true.

The page prompts for recent care, collects the amount insurance paid, shows a
summary, and requires confirmation. Skipping or previewing never calls this write
route. Reject unconfirmed, invalid, future-dated or over-maximum reports.

Return 201 with the saved report and refreshed benefits. An identical retry
returns 200 with the same report and refreshed benefits. A conflicting reused
submission ID returns 409. Perform the amount check, report creation and period-total increment
in one Firestore transaction.
The caller refreshes/recomputes visible estimates after success.

## POST /api/chat

Input: employee_id, optional session_id, and exactly one of text or event.
Text is a nonempty string limited to 1000 characters.
Supported events start or restart the guided flow; select-procedure and compare
choices may use text or events defined in the conversation contract.

When session_id is absent, create a random context and bind it to employee and
fixture set. A supplied session must exist and belong to that employee; otherwise
return a context error and offer restart.

Response: session_id, messages (plain text array), choices (label/value array),
conversation_state, optional estimate, optional comparison, refreshed benefits,
and conversation_mode. Structured results come from backend calculations, not
parsed response prose. Frontend renders text with textContent and discards stale
responses after profile changes.

Cloud-mode timeout/failure returns 503 with a retry message, preserves the last
valid display, and does not silently change conversation mode.
Local-demo mode uses the same benefits services but is labeled as local demo.

## POST /api/dialogflow/webhook

Standard Dialogflow CX webhook. Verify configured authorization header before
processing. Requests without valid authorization return 401.

Use sessionInfo.session and an opaque context reference to resolve backend-bound
employee context. Treat sessionInfo.parameters as procedure/date/network choices
only. Do not trust supplied coverage, annual allowance, usage, or employee changes.

Tags: `benefits.summary`, `benefits.estimate`, `benefits.compare`.
Estimate and comparison tags require a supported procedure. Missing inputs
reprompt and never mutate usage. Recent-care writes use the explicit confirmed
usage route rather than webhook inference.

Response uses fulfillmentResponse.messages for text, sessionInfo.parameters for
validated choices, and payload for the structured estimate/comparison. The chat
adapter reads queryResult.webhookPayloads and then refreshes benefits from Python.
Webhook failures produce recoverable flow messages, not fabricated estimates.

## Static Interface and Setup

GET / serves the dashboard; frontend assets use relative same-origin paths.
The Python service uses environment-provided fixture path, Firebase project
configuration and optional Firestore emulator host,
optional reference date, conversation mode, project, location, agent ID, and
webhook authorization secret. Secrets are absent from public responses, files
in version control, and frontend source.

The initial identity model is a fictional employee selector. Firebase
Authentication sign-in is excluded from the first demo by user choice. Public
hosting and live CX connectivity require later setup and verification; planning
does not publish the application or create a Cloud project.
