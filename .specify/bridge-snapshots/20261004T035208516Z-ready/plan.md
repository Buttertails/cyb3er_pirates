# Implementation Plan: Personalized chatbot and benefits exploration

**Branch**: feat/personalized-chatbot | **Date**: 2026-10-03 | **Spec**: spec.md
**Source**: approved personalized-chatbot expansion design and selected extras.

## Summary

Extend the existing deterministic CX flow and shared Flask calculator. Deliver a
working website conversation first, then curated alternatives and dated stage
comparisons, followed by what-if cards and a timeline. Preserve the team's
current dashboard/login and add a chat entry point. Spec Kit tasks are canonical;
implementation is inline through the Superpowers bridge in an isolated worktree.

## Technical Context

Python 3.12, Flask 3.0.3, existing Dialogflow CX 2.7.0 SDK, Waitress and vanilla
JavaScript. Existing Firebase Authentication; read-only fictional profiles and
policy/procedure files. No new database, project, bucket or employer admin.
Cloud Run dental-api and Firebase Hosting in cyb3r-pirates; existing CX agent in
us-east1, ea6d5b47-1426-4edd-b895-7d4f275f0a65. pytest, Node tests, controlled
live CX and website journeys. English demo; 18s browser deadline, existing 15s
CX timeout with no SDK retries. Keep cloud capacity unchanged (min0/max2).

## Constitution Check

Pass before and after planning: insured-employee demo, one plan per company,
explicit employee selection, shared backend amounts, recorded versus projected
care, guided recovery, private credentials and meaningful TDD/live evidence.
The team's existing browser approximation is not reused for new chat features.
No constitution amendment or tool upgrade is needed.

## Research Decisions

See research.md. Existing agent procedure_id differs from webhook procedure;
normalize aliases before calculation. Existing engine has a lifetime-max field
but does not enforce it; existing sequencing resets usage too broadly for this
feature. Add narrowly scoped lifetime/dated-stage logic with regression tests,
without assuming that the adapter's annual-derived lifetime value is a real rule.
Use explicit fictional rule overrides only for demo cases that require them.

## Project Structure and Responsibilities

- backend/chat_routes.py: thin HTTP and CX adapters; authenticated website turns,
  authoritative payload checking and recovery. Keep existing API paths.
- backend/chat_context.py: signed portable context, bound to verified UID and
  explicit fictional employee; expiry and fixture-set checks preserved.
- backend/dialogflow_client.py: real text/events and allowlisted input parameters;
  no browser-provided financial values or arbitrary events.
- backend/chat_profiles.py: validated plan/employee/usage selection.
- backend/chat_service.py (new): case normalization, navigation state, deterministic
  prompts and result composition, separate from HTTP handlers.
- backend/dental/treatment_options.py (new): validate curated option/stage/rule
  data and resolve trusted option prices; no model-generated substitutes.
- backend/dental/scenarios.py (new): dated comparisons and timeline projection
  from shared engine results; independent scratch usage per scenario.
- backend/dental/engine.py and models.py: only needed lifetime cap/optional
  trusted stage-price support, existing outputs retained and regression-tested.
- backend/fixtures/treatment_options.json (new): clearly fictional curated
  options, stage constraints and explicit rule overrides, existing catalog IDs.
- chat/agent-config/: fresh full backup and per-increment snapshots.
- tools/dialogflow/: scoped inspect/update/rollback tooling (new if absent),
  previews and applies only the current batch, preserves existing resource IDs.
- frontend/chat.html and js/chat.js (new): real signed-in chat, explicit demo
  employee selector, messages/choices, loading/recovery and current case state.
- frontend/js/scenario-cards.js and benefits-timeline.js (new): structured result
  rendering only; no independent coverage formula.
- frontend/profile.html: small chat link; preserve teammate profile/update flow.
- .dockerignore/.gcloudignore: include only the added exact production fixture;
  keep credentials/tools/tests excluded. Existing deployment scripts/config
  remain the delivery path; no Functions conversion.
- backend/tests/, frontend/tests/: contract, engine, navigation and DOM/state
  coverage. specs/004-personalized-chatbot/verification.md records each live batch.

## Integration Contract

See contracts/chat.md and contracts/agent-flow.md. Keep existing response fields;
add case, comparisons, timeline and revision. Canonical procedure parameter is
procedure_id, accepting legacy procedure only when consistent. Structured UI
events are allowlisted; the unrelated intake.* proposal remains in local_demo
until separately reconciled. No switch of the whole intake API mode.

Authentication verifies the existing Firebase token without creating accounts.
The signed token binds UID, employee, fixture set and CX session. Demo employee
choice is displayed on every result and can change only via confirmed restart.
The real account's company is never inferred from hardcoded frontend defaults.
Recorded usage comes from validated demo fixtures. Browser-only history/sample
appointments remain existing UI data and are not imported as claimed benefits.

## Delivery Phases

1. Baseline and backup; validated case/context and live fulfillment contract.
2. Navigation/intake/summary/estimate and thin website chat. First live milestone.
3. Curated options and stage/reset comparisons with shared-engine guarantees.
4. What-if cards and timeline, synchronized with conversation scenario state.
5. Independent review, regression/live evidence, current cloud delivery, merge,
   bridge completion and convergence.

Each remote batch has a backup, reviewed diff, one focused conversation and
rollback record. Configure required existing chat environment and webhook only
when backend contract is ready. Generate private keys outside Git; never expose
them in logs/browser. If permissions or extra resources are actually needed,
surface that requirement before changing IAM or creating resources. Existing
billing authorization covers controlled live turns in this project.

## Failure Handling and Verification

An unsupported scenario returns reasons and supported choices. Retry retains
last valid results labeled previous; expiry offers confirmed restart. Browser
serializes sends, assigns request IDs and ignores late responses not matching
active case/revision. Invalid financial or identity payloads fail closed.

TDD checks company/usage differences, forged tokens/payloads, navigation loops,
excluded options, lifetime versus annual caps, stage order/windows, and no-write
projection. UI tests cover synchronized cards/timeline, restore, keyboard and
stale replies. Existing 165-test backend and 4 config-test baselines remain gates.
Actual live CX through website must satisfy all SC scenarios; fake CX tests alone
never count as live completion. No account/usage writes for verification.
