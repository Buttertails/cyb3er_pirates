# Backend Chat API

Additions to the existing Flask API. Existing routes remain intact.
New errors: `{error:{code,message}}`. Invalid inputs 422, unknown employee 404,
invalid context 409, invalid webhook authorization 401, missing configuration
or external-service failure 503.

## POST /api/chat

Request: employee_id, optional session_id, exactly one of text or event.
Text is nonempty, at most 1000 characters. Events are start and restart.
Unknown fields, including policy/usage overrides, are rejected. Restart generates
a fresh session for the selected employee. Reused sessions must match employee
and fixture set. A successful response contains session_id (opaque signed
reference), messages (string array), choices (label/value array),
conversation_state (current page name), estimate (object or null), benefits,
conversation_mode:dialogflow, demo_data:true.

Benefits contain employee_id/name, company_id/name, plan_id/name, plan_year,
annual_maximum, used, remaining, percent_used and as_of. An estimate is the
team's existing engine result with identity, choices and assumptions added.
Public amounts are dollars; fixture usage is cents. Recorded benefits are
never replaced by projected usage.

Sample employee IDs: demo-a-pat (plan 0, $250 used in 2026), demo-a-sam
(plan 0, $7400 used in 2026), demo-c-lee (plan 2, $500 used in 2026).
CHAT_REFERENCE_DATE=2026-10-03 gives repeatable sample results.

## POST /api/dialogflow/webhook

Require `Authorization: Bearer <DIALOGFLOW_WEBHOOK_TOKEN>`.
Standard request: fulfillmentInfo.tag, sessionInfo.session and
sessionInfo.parameters.backend_context. The signed reference must bind to the
exact configured agent/session path. Tags: benefits.summary and benefits.estimate.

Only procedure, network and treatment_date parameters influence choices;
employee/plan/coverage/usage parameters cannot override backend context.
Network values in_network/out_of_network and in-network/out-of-network are
normalized. Unknown values reprompt; never default.

Return fulfillmentResponse.messages and payload:
`{type:"dental_benefits",status:"ok"|"needs_input",benefits,estimate,choices,prompt}`.
Successful estimates include validated procedure/network/treatment_date choices.
Reprompts contain estimate:null. Invalid choices clear the offending sessionInfo
parameter. Use REPLACE message mode. Chat treats webhook failure status as 503
and never surfaces earlier estimates. Unsupported tags return a scope message.
Only the final dental fulfillment payload controls the current result. Backend
prompts replace earlier response text; financial summaries and estimate messages
are regenerated from current backend calculations.

## Setup boundary

Keys/tokens are environment configuration, not committed values. This feature
creates no cloud resources and configures no remote agent. Later authorized
work attaches the webhook and tags, deploys with configuration and verifies a
live conversation.
