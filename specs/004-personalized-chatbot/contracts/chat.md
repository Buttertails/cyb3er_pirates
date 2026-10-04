# Chat and comparison contract

## HTTP boundary

POST /api/chat uses the existing Firebase Bearer ID token. Request retains
employee_id and optional signed session_id plus exactly one of text or event.
Text is nonempty and at most 1000 characters. Legacy start/restart string events
remain; new structured event shape is {name, parameters}. Only approved names
are accepted. Unknown fields, extra parameters and financial/identity overrides
return 422; missing/invalid auth returns 401; invalid context returns 409;
service/config failure returns explicit 503. Secrets are never returned.

Allowlisted events and parameters:
- start/restart: none (explicit employee selection supplied at top level).
- menu/help/back/why: none.
- compare.network: none (compare both supported networks).
- change.procedure: procedure_id (supported catalog ID).
- change.network: network (in_network/out_of_network).
- change.date: treatment_date (YYYY-MM-DD).
- change.budget: budget_cents (null or nonnegative integer).
- alternatives.show/timing.show/usage.show/scenario.restore: none.
- scenario.select: option_id or schedule_id (known IDs from current result),
  exactly one; optional network/date use dedicated change events.

An event may include only its listed parameters. No plan ID, company override,
coverage rate, amount, usage array, arbitrary CX event or backend_context can be
submitted by the browser. Top-level employee_id is explicitly fictional context,
validated and signed, not a claim of real account employer membership.

Response keeps session_id, messages[], choices[], conversation_state, estimate,
benefits, conversation_mode=dialogflow and demo_data=true. Add case, scenario,
comparisons, timeline and revision, null/empty when not yet available.
choices entries retain label/value for text choices; structured choices may add
an allowlisted event object. Case/scenario IDs are server generated. Browser
uses its request sequence to discard replies after a newer case/request.

Financial payloads must be recomputed/verified from authoritative context and
trusted fixture option/stage IDs before returning prose, estimate, comparisons
or timeline. Do not extend the existing exact estimate check by trusting other
financial payloads unverified. Prompt text is deterministic backend output.
All result fields show employee/company/plan identity and fictional assumptions.

## CX webhook

Existing POST /api/dialogflow/webhook requires current private Bearer token and
signed session context matching the CX session path. Supported fulfillment tags:
benefits.summary, benefits.estimate, benefits.explain, benefits.alternatives,
benefits.timing, benefits.timeline, conversation.navigate.

Canonical parameters: backend_context (injected by server), procedure_id,
network, treatment_date, budget_cents, deadline, option_id, schedule_id,
return_to and scenario_revision. procedure is accepted as legacy alias only
when absent canonical value or both agree; disagreement requests clarification.
Normalize network synonyms to backend enum. Invalidated values are explicitly
set null. All values are independently validated; no session financial overrides.

Fulfillment follows current fulfillmentResponse plus payload type=dental_benefits
and sessionInfo.parameters. Payload adds validated case/scenario/comparisons/
timeline to existing benefits/estimate/inputs/prompt/status. Status ok or
needs_input remains, with unsupported reasons represented in comparison status.

## UI behavior

Thin additive chat page, signed-in account indicator and labeled fictional
employee selector. Selecting a different employee asks to restart. Messages,
buttons, cards and timeline use text nodes (no unsafe injected HTML). Controls
have labels, keyboard access and loading/error states. One active send, retry
preserves previous results, no auto-repeat of financial side effects. New result
revision supersedes projections only; restore returns baseline inputs/results.
Existing intake.* proposal and local_demo API_CONFIG are not flipped globally.
