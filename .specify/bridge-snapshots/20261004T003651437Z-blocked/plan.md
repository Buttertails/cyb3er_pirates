# Implementation Plan: Backend Chat Integration

**Branch**: `feat/backend-chat` | **Date**: 2026-10-03
**Spec**: [spec.md](spec.md)
**Source**: Approved backend integration design; current team Flask implementation.

## Summary

Register a chat blueprint with `backend/main.py`. Reuse `dental.engine`,
`dental.catalog`, and `dental.mock_plans`. Add validated read-only sample profiles,
signed context, a CX client adapter, and authenticated standard webhook.

## Technical Context

- Python 3.12, Flask 3.0.3, current Firebase Functions/Admin dependencies.
- Pin google-cloud-dialogflow-cx 2.7.0; import/create its client only on a live call.
- Read-only `backend/fixtures/demo.json` and existing `Data/plans.json`.
- pytest route/service tests; external SDK calls mocked. No cloud calls in tests.
- Cloud Functions-compatible stateless context, signed with stdlib HMAC SHA-256.
- 30-minute session expiry; 15-second SDK deadline, automatic retries disabled.
- Reference date defaults to current date; optional CHAT_REFERENCE_DATE for demo.
- No framework switch, persistent session database, UI edits or deployment.

## Constitution Check

Pass before and after planning: one procedure, exactly one plan per company,
employee-specific usage, existing shared calculator, explicit fictional data,
no estimate writes, TDD and honest live-verification boundaries. Persistent
confirmed usage remains outside this read-only adapter feature.

## Components and Data Flow

`chat_profiles.py` validates fixture relationships and resolves EmployeeContext.
`chat_context.py` validates configuration and signs/verifies session references.
`dialogflow_client.py` builds SDK requests and converts protobuf responses to
camelCase dictionaries. `chat_routes.py` owns the Flask blueprint and fulfillment.

Chat validates request/context, reloads the employee, adds a signed
backend_context parameter and calls the regional CX SessionsClient. The
webhook verifies authorization and the exact configured CX session resource,
reloads that employee, validates only procedure/network/date choices, and calls
the existing engine. It returns text and a structured estimate payload. Chat
accepts that payload only after recomputing the result from validated choices
and comparing it with the shared engine. Error or reprompt payloads clear the
current estimate. Recorded benefits stay distinct from projected balances.

Start/restart API actions send hello to the existing welcome intent; restart
uses a new random CX session. No remote event setup is needed for those actions.

## Configuration and Source Layout

Required: DIALOGFLOW_PROJECT_ID, DIALOGFLOW_LOCATION, DIALOGFLOW_AGENT_ID,
CHAT_SIGNING_KEY (at least 32 characters), DIALOGFLOW_WEBHOOK_TOKEN (at least
32 characters). Optional: DIALOGFLOW_LANGUAGE_CODE (en), CHAT_REFERENCE_DATE,
CHAT_FIXTURE_PATH. Server ADC is used only on a live SDK request.

Source: backend/chat_profiles.py, chat_context.py, dialogflow_client.py,
chat_routes.py, fixtures/demo.json, and corresponding tests/test_chat_*.py and
tests/test_dialogflow_client.py. Public amounts preserve engine dollar fields;
usage records remain cents. Sample IDs and API shapes are in contracts/api.md.

## Verification and Delivery

Execute T001–T006 in canonical tasks.md through the bridge. Keep the original
66-test baseline passing. Review, finish the branch, and assess convergence
before marking this feature complete. No mocked test proves a live connection.
Do not push, merge or deploy without explicit authorization.
