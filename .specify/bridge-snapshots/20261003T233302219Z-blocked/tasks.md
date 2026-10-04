# Tasks: Dental Benefits Assistant

**Input**: [spec.md](spec.md), [plan.md](plan.md), [research.md](research.md),
[data-model.md](data-model.md), and [contracts/](contracts/).
**Status**: Generated only. Implementation is not authorized by the current request.
**Tests**: TDD is required by the user's workflow and constitution. Test tasks
precede the behavior they verify. Every checkbox below is initially unchecked.

## Format: `[ID] [P?] [Story] Description`

[P] means independent files after stated prerequisites are complete.
[US1], [US2], and [US3] map to the canonical user stories. File paths are
repository-relative planned targets; these files have not been created.

## Phase 1: Setup

- [ ] T001 Define pinned Python/Firebase/CX and browser-test dependencies and local configuration in requirements.txt, package.json, .env.example, .gitignore, firebase.json, and firestore.rules; configure direct browser database access as denied and keep credentials/emulator exports ignored (FR-012, FR-017).
- [ ] T002 [P] Prepare fictional policy/procedure/profile seed data in backend/fixtures/demo.json and document collaborator JSON mappings in docs/json-data-mapping.md; use at least two companies and differing employee usage, preserving explicit units and missing network information (FR-001, FR-011, FR-016).

## Phase 2: Foundational

**Goal**: Validated data, Firestore access, shared configuration and API errors.

- [ ] T003 Write failing validation cases in backend/tests/test_data.py, then implement backend/models.py and backend/repository.py; enforce “exactly one nested plan,” “integer >= 0,” coverage “between 0 and 1,” unique IDs, valid annual reset dates and resolvable employee/company references from data-model.md (FR-001, FR-011).
- [ ] T004 Write API/configuration checks in backend/tests/conftest.py and backend/tests/test_api.py before implementing backend/__init__.py, backend/config.py and backend/app.py; serve same-origin static assets, load .env, set reference date and explicit conversation mode, and normalize error envelopes without exposing credentials (FR-010, FR-012, FR-015).
- [ ] T005 Write failing import/read tests in backend/tests/test_data.py, then implement backend/firestore_store.py and backend/seed.py; read runtime profiles/period usage from Firestore, validate before seeding, preserve existing reported totals, and isolate fixture-set identities using the emulator (FR-002, FR-011, FR-017).

**Checkpoint**: Data contract and Firestore reads work without estimates.

## Phase 3: User Story 1 — Understand Coverage (P1 / MVP)

**Independent test**: Select a fictional employee, estimate a crown, and verify
company/usage-specific shares and matching dashboard/chat results.

- [ ] T006 [US1] Add failing calculation examples to backend/tests/test_benefits.py for the crown scenarios in contracts/data.md, zero allowance, exact reset boundary, rounding and unknown network data; assert estimates do not mutate Firestore usage (FR-002, FR-005, FR-006).
- [ ] T007 [US1] Implement backend/benefits.py with benefit-period derivation, decimal ROUND_HALF_UP rounding to integer cents, allowance-limited insurer contribution, employee-share reconciliation, and plan-grounded explanations (FR-002, FR-005, FR-009, FR-012).
- [ ] T008 [US1] Add failing bootstrap/benefits/estimate API contracts to backend/tests/test_api.py, including unknown profiles, missing prices, invalid dates and money, and unavailable Firestore reads (FR-003, FR-005, FR-010, FR-011).
- [ ] T009 [US1] Implement bootstrap, employee-benefits and estimate routes in backend/app.py using backend/repository.py, backend/firestore_store.py and backend/benefits.py; satisfy contracts/api.md without mutating usage (FR-002, FR-003, FR-005, FR-006, FR-009).
- [ ] T010 [P] [US1] Write failing browser checks in frontend/tests/dashboard.spec.js, then build frontend/index.html and frontend/styles.css with a labeled fictional employee selector, plan/allowance summary, result area and guided-chat panel; support keyboard and phone-width use (FR-003, FR-012, FR-015).
- [ ] T011 [US1] Implement frontend/api.js and frontend/app.js against the API contracts; refresh employee benefits, render text safely, show loading/retry states, clear old results on profile change and discard obsolete in-flight responses, passing frontend/tests/dashboard.spec.js (FR-003, FR-009, FR-015).
- [ ] T012 [P] [US1] Define CX pages, procedure entities, choices, tags and no-match/error handlers in chat/flow-blueprint.json and chat/README.md using contracts/conversation.md; do not represent a blueprint as a verified agent export (FR-004, FR-010).
- [ ] T013 [US1] Add failing adapter/webhook tests in backend/tests/test_conversation.py for employee-bound sessions, unsupported questions, forged benefit parameters, webhook authorization, structured payloads and cloud failure behavior (FR-002, FR-004, FR-009, FR-010).
- [ ] T014 [US1] Implement backend/conversation.py, backend/dialogflow.py and chat/webhook routes in backend/app.py; use shared benefit services, explicit local_demo mode, server-side CX credentials, authenticated standard webhook and configured deadlines (FR-004, FR-009, FR-010, FR-012).
- [ ] T015 [US1] Extend frontend/tests/dashboard.spec.js with a guided coverage journey, profile switch during chat and plan-change redirect, then connect the chat UI in frontend/app.js; display structured backend results alongside conversation and preserve last valid results on failure (FR-003, FR-004, FR-009, FR-010, FR-015).

**Checkpoint**: US1 is a complete demo in explicit local mode; live CX verification
is tracked separately in T024.

## Phase 4: User Story 2 — Compare Options (P2)

**Independent test**: Compare one procedure now and after the reset, with available
network alternatives and explicit assumptions. No estimate changes usage.

- [ ] T016 [US2] Write failing cases in backend/tests/test_comparisons.py and frontend/tests/comparisons.spec.js for current/following periods, known versus zero future usage, network differences and missing network information (FR-007, FR-008, FR-014).
- [ ] T017 [US2] Implement backend/comparisons.py, compare route/webhook tag in backend/app.py and backend/conversation.py using the same benefit calculator; return one-procedure date/network alternatives with continuing-plan/price assumptions (FR-007, FR-008, FR-009, FR-014).
- [ ] T018 [US2] Implement comparison controls/results in frontend/index.html, frontend/app.js and frontend/styles.css; pass frontend/tests/comparisons.spec.js, keeping costs, unavailable data and timing assumptions visible (FR-007, FR-008, FR-012, FR-014, FR-015).

## Phase 5: User Story 3 — Track Utilization (P3)

**Independent test**: Prompt for recent care; skip leaves usage unchanged.
A confirmed report updates both views and survives restart exactly once.

- [ ] T019 [US3] Write failing report tests in backend/tests/test_usage.py and frontend/tests/usage.spec.js for confirmation, skip, missing insurer-paid amount, future dates, over-maximum amounts, duplicate/conflicting IDs, concurrent reports and restart persistence (FR-006, FR-013, FR-017).
- [ ] T020 [US3] Implement backend/usage.py and transactional writes in backend/firestore_store.py; read before writes, validate “nonnegative integer” contribution, atomically create the submission and increment reported_cents, reject conflicting reuse and perform no external side effects on transaction retries (FR-002, FR-013, FR-017).
- [ ] T021 [US3] Implement confirmed usage route in backend/app.py and report summary in benefits responses; return fresh usage and handle Firestore failure without claiming a report was saved, passing backend/tests/test_usage.py (FR-003, FR-009, FR-013, FR-017).
- [ ] T022 [US3] Implement the recent-procedure prompt, amount/date form, preview, confirm and skip in frontend/index.html and frontend/app.js; refresh benefits and recompute visible estimates after a confirmed write, passing frontend/tests/usage.spec.js (FR-003, FR-006, FR-009, FR-013, FR-015).

## Phase 6: Documentation and Verification

- [ ] T023 [P] Document local setup, Firestore emulator import/export, validated JSON replacement, user database credentials/IAM and database-only scope in README.md and docs/firebase-setup.md; ensure run commands match the implementation (FR-011, FR-016, FR-017).
- [ ] T024 Document and configure the live CX connection with supplied project/agent/HTTPS webhook inputs in docs/dialogflow-setup.md; verify an actual guided journey and error handlers, preserve a verified export in chat/agent-export/, and record external setup limitations in docs/verification.md (FR-004, FR-009, FR-010).
- [ ] T025 Execute the scenarios in specs/001-dental-benefits-assistant/quickstart.md with backend and browser tests; verify Firestore persistence, profile switching, costs, comparisons, usage confirmation and responsive/keyboard behavior, recording fresh evidence in docs/verification.md (FR-001 through FR-017; SC-001 through SC-006).
- [ ] T026 Request code review, resolve material findings, run verification-before-completion and branch finishing, and update docs/verification.md and canonical specs/001-dental-benefits-assistant/tasks.md; preserve bridge state/history and do not mark live integration verified from mocks (constitution and SC-005, SC-006).

## Dependencies and Execution Order

- T001 precedes dependency-dependent tasks. T002 may be prepared concurrently
  as data/document work. Foundation T003–T005 must finish before integrated
  data-dependent story behavior. T010 and T012 may begin after T001 using the
  agreed contracts, mocked API responses, and documented fixture examples.
- T006 → T007 → T008 → T009; T010 may begin after T001 with mocked API responses,
  independently of API implementation; T011 integration requires T009/T010.
- T012 may begin after T001 in parallel with data/backend/UI work. T013 → T014 requires
  T007/T009/T012; T015 requires T011/T014.
- US2: T016 → T017 → T018, after the shared estimate services and frontend shell.
- US3: T019 → T020 → T021 → T022, after shared Firestore reads and frontend shell.
- Backend work in US2 and US3 may proceed independently in service/test files.
  Serialize edits to backend/app.py, frontend/app.js and frontend/index.html.
- T023 can proceed alongside late story work. T024 depends on supplied live
  configuration. T025/T026 follow completed behavior and accurate setup status.

## Parallel Examples

- US1: calculation tests/service and dashboard markup/tests use separate files;
  CX blueprint work is independent once the interfaces are fixed.
- US2/US3: comparison tests/service and usage tests/service can progress separately.
  Their API/UI integrations share files and are sequential.
- Team members can prepare incoming JSON mapping and cloud setup documentation
  while service work progresses. These are work-sharing examples, not a second
  task hierarchy.

## Implementation Strategy

Deliver US1 first; validate before adding US2 comparisons and US3 reporting.
Use TDD for behavior changes and systematic debugging for failures.
Checkpoints validate each slice; canonical tasks remain the only completion list.

When implementation is later requested, invoke `$speckit-superpowers-bridge`,
which derives a disposable adapter from these tasks. Do not invoke
`speckit-implement`, native brainstorming, or writing-plans for this active
feature. After tasks, review, verification and branch finishing, complete the
bridge and run `$speckit-converge`; append any remaining work to this same file.

## Deferred Stretch Goals

- Employer policy editing interface.
- Sequencing multiple procedures across a plan year.
- End-of-year unused-benefit reminders.

These are not executable tasks in this initial handoff. Adding them requires a
canonical specification/plan update and new tasks. Firebase Authentication is
excluded from the first demo, as confirmed by the user.

## Notes

Incoming JSON and live cloud configuration are external inputs. Representative
fictional fixtures and the Firestore emulator support local development. Local
conversation mode must be labeled, and cannot substitute for the live CX check.
This planning-only request leaves all 26 implementation checkboxes unchecked.
