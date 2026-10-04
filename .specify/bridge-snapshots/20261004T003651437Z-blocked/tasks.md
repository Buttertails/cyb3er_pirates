# Tasks: Backend Chat Integration

Source: spec.md, plan.md, data-model.md and contracts/api.md. Backend-only
approved slice; the older 001 project tasks remain untouched. Use TDD and the
bridge. No live calls, remote configuration, frontend edits, cloud provisioning,
push, merge or deployment.

## Phase 1: Setup and Foundational

- [x] T001 Write failing fixture-validation and employee-specific benefit tests in backend/tests/test_chat_profiles.py; implement backend/chat_profiles.py and read-only backend/fixtures/demo.json, checking IDs, one-plan relationships, offered member types, ISO dates, supported procedures, "integer >= 0" usage amounts and per-period annual maximum (FR-001, FR-005, FR-008).
- [x] T002 [P] Write failing configuration/session tests in backend/tests/test_chat_context.py; implement backend/chat_context.py with required environment configuration, HMAC SHA-256 context, 1800-second expiry, maximum 2048-character token, employee/fixture/session binding and restart support (FR-002, FR-003, FR-004).

## Phase 2: US1 — Contextual Coverage Conversation

- [x] T003 [US1] Write failing authenticated webhook tests in backend/tests/test_chat_routes.py; implement backend/chat_routes.py blueprint and registration in backend/main.py, verifying configured authorization and exact CX session, summary/estimate tags, validated choices, REPLACE messages, structured results and no usage writes (FR-001, FR-004, FR-005, FR-006).
- [x] T004 [US1] Write failing SDK adapter tests in backend/tests/test_dialogflow_client.py; implement backend/dialogflow_client.py and pin the SDK in backend/requirements.txt, using regional endpoint, server credentials, 15-second deadline, retry=None and protobuf-to-camelCase conversion without real API calls (FR-003, FR-006, FR-007).
- [x] T005 [US1] Extend backend/tests/test_chat_routes.py with complete fake-service journeys, employee switches, expiry, restart, invalid JSON, forged overrides, webhook failures and changed network; implement /chat in backend/chat_routes.py with fresh benefits, verified structured estimates, safe errors, supported choices and no stale results (FR-001 through FR-008).

## Phase 3: Review and Verification

- [x] T006 Run the full backend suite, request review, resolve material findings, verify changes, finish the branch and record results/remaining live setup in specs/002-backend-chat/verification.md; complete bridge and convergence without claiming deployed or live integration (FR-007, FR-008, SC-001 through SC-004).

## Dependencies and Parallel Opportunities

T001 and T002 can progress independently in separate modules. T003 requires
both. T004 requires configuration from T002; its tests/module do not share
T003 files. T005 requires T001–T004. T006 follows T005.
Execution is inline in this session; parallel opportunities describe team work.

## Implementation Strategy

Implement validated data and session context, then the webhook, then the SDK
adapter and chat endpoint. Verify each task RED→GREEN. All tasks describe only
the approved backend slice; later live setup is not part of this task list.
