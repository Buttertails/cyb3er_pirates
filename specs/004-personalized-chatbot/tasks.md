# Tasks: Personalized chatbot and benefits exploration

Input: approved design, spec.md, plan.md, research.md, data-model.md and contracts/.
TDD is mandatory for behavior changes. Canonical checkboxes are the completion
record; the bridge owns inline execution. No product implementation in planning.

## Phase 1: Setup

- [ ] T001 Establish isolated feature worktree, baseline tests and current cloud/agent configuration inventory; save full sanitized CX backup under chat/agent-config/ and record resource IDs and rollback in specs/004-personalized-chatbot/verification.md (FR-013).

## Phase 2: Foundation

- [ ] T002 Add failing case/context/fixture validation tests in backend/tests/test_chat_context.py and backend/tests/test_treatment_options.py for signed UID/employee/fixture mismatch, catalog references, nonnegative integer cents, stage order/window and optional preference constraints; reproduce baseline procedure_id mismatch (FR-002, FR-003, FR-011).
- [ ] T003 Implement validated case/preferences and UID-bound signed context in backend/chat_context.py, backend/chat_service.py and backend/chat_profiles.py: budget is "null or nonnegative integer", dates are "null or valid YYYY-MM-DD date", no date before displayed reference date or after deadline; retain expiry/fixture checks and explicitly restart incompatible old tokens (FR-002, FR-003, FR-011).
- [ ] T004 Add validated curated option/stage/rule loader in backend/dental/treatment_options.py and fictional backend/fixtures/treatment_options.json: catalog references, "nonnegative integer cents", "positive unique integer" order, "earliest <= latest" stage windows, explicit lifetime rule or unknown; add exact fixture exclusions exceptions in .dockerignore/.gcloudignore and confirm no private uploads (FR-006, FR-007, FR-011).

## Phase 3: User Story 1 - Live coverage conversation (P1)

Goal: complete and revisit a website conversation. Independent check: estimate,
help-and-resume, changed answer and restored treatment under two companies.

- [ ] T005 [US1] Write failing text/event/auth/alias/financial-verification tests in backend/tests/test_chat_routes.py and backend/tests/test_dialogflow_client.py for contracts/chat.md, including unknown overrides, conflicting aliases and service failures (FR-004, FR-005, FR-010, FR-011).
- [ ] T006 [US1] Extend backend/dialogflow_client.py and backend/chat_routes.py for authenticated allowlisted events/parameters, procedure_id normalization, preserved legacy start/restart, authoritative response verification and explicit errors per contracts/chat.md; retain existing routes/results (FR-004, FR-005, FR-010, FR-011).
- [ ] T007 [US1] Add failing navigation/interruption/change/reset tests in backend/tests/test_chat_service.py, then implement deterministic prompts, preserved preferences, return_to, dependent-state clearing, help/why/fallback and HR guidance in backend/chat_service.py (FR-001, FR-002, FR-012).
- [ ] T008 [US1] Add scoped snapshot/diff/apply/restore tooling in tools/dialogflow/; back up and update CX navigation/Menu/Procedure/Network in one batch, preserving IDs; record supported synonyms, unsure branch and focused live route evidence in chat/agent-config/ and verification.md (FR-001, FR-002, FR-012, FR-013).
- [ ] T009 [US1] Back up and add CX Priorities/Coverage/Estimate/Benefits and help-return routes as a second batch using contracts/agent-flow.md; configure only existing Flask chat environment and agent webhook with private values outside Git/browser; record a real backend-fulfilled estimate in specs/004-personalized-chatbot/verification.md (FR-004, FR-010, FR-011, FR-013).
- [ ] T010 [US1] Write failing thin-chat UI tests in frontend/tests/chat.test.mjs, then add frontend/chat.html and frontend/js/chat.js plus small frontend/profile.html link for signed-in live turns, explicit fictional employee selection, choices and confirmed restart; preserve the team's intake mode and profile/update screens (FR-003, FR-010, FR-014).
- [ ] T011 [US1] Verify and release first website conversation to existing dental-api/Hosting; complete two live company journeys with help/resume and answer changes, record failures/recovery and rollback in specs/004-personalized-chatbot/verification.md (FR-013, SC-001, SC-005).

## Phase 4: User Story 2 - Personalized options (P2)

Goal: curated comparable treatments with budget fit. Independent check: same
case under two policies, partial/excluded and no-supported/cheaper options.

- [ ] T012 [US2] Add failing option/budget/excluded/no-cheaper tests in backend/tests/test_scenarios.py, then implement curated option calculations with trusted fixture fees through shared backend/dental/engine.py and backend/dental/scenarios.py, preserving standard estimates and recorded usage (FR-005, FR-006).
- [ ] T013 [US2] Add alternatives fulfillment and independently verified financial payloads in backend/chat_service.py and backend/chat_routes.py; back up/add CX Options/review branch and option navigation, record focused live evidence in chat/agent-config/ and verification.md (FR-006, FR-012, FR-013).

## Phase 5: User Story 3 - Dated treatment/reset schedules (P2)

Goal: compare only feasible schedules. Independent check: stage order/window,
reset savings, no savings, deadline and lifetime limit without usage writes.

- [ ] T014 [US3] Add failing lifetime/dated-stage/deadline/reset tests in backend/tests/test_engine.py and backend/tests/test_scenarios.py; cover separately priced stages, equivalent all-now baseline, cumulative deductible/frequency/annual and lifetime usage (FR-005, FR-007).
- [ ] T015 [US3] Implement explicit lifetime-cap enforcement in backend/dental/engine.py and necessary backend/dental/models.py support; implement ordered dated scratch-usage projections and per-year summaries in backend/dental/scenarios.py, never synthesize an explicit lifetime rule from annual maximum (FR-005, FR-007).
- [ ] T016 [US3] Integrate timing/usage fulfillment and verified scenario payloads in backend/chat_service.py and backend/chat_routes.py; back up/add CX Timing/Review stages, dates and recovery routes; record feasible, no-savings, deadline-blocked and lifetime/unknown cases in verification.md (FR-007, FR-012, FR-013, SC-003).

## Phase 6: User Story 4 - What-if cards and timeline (P2)

Goal: visible synchronized comparisons and recorded/projected usage.
Independent check: three control changes, restore and stale-reply recovery.

- [ ] T017 [US4] Write failing scenario-selection/restore/revision/timeline tests in backend/tests/test_scenarios.py and backend/tests/test_chat_routes.py, then expose baseline/scenario/differences and recorded/projected/reset entries from backend/dental/scenarios.py and chat adapters; reset entries carry no payment, only current case IDs accepted (FR-005, FR-008, FR-009).
- [ ] T018 [P] [US4] Add failing card interaction/restore tests in frontend/tests/scenario-cards.test.mjs then render labeled baseline/scenario/differences and allowed controls in frontend/js/scenario-cards.js; all amounts from server, retain unrelated preferences (FR-005, FR-008).
- [ ] T019 [P] [US4] Add failing timeline labels/year-grouping tests in frontend/tests/benefits-timeline.test.mjs then render recorded/projected/reset entries and per-year summaries in frontend/js/benefits-timeline.js; no independent coverage formulas (FR-005, FR-009).
- [ ] T020 [US4] Integrate cards/timeline in frontend/chat.html and frontend/js/chat.js with synchronized case/revision, keyboard labels, pending/error/previous-result states, serialized sends and discarded stale replies; prove three changes and baseline restore without new usage in frontend/tests/chat.test.mjs (FR-008, FR-009, FR-014, SC-004).

## Phase 7: Review and delivery

- [ ] T021 Request independent code review, run full backend/frontend/production checks and all six comparison classes; fix scoped findings through TDD and record evidence in specs/004-personalized-chatbot/verification.md (FR-005, FR-011, SC-002, SC-005).
- [ ] T022 Publish intended Flask/Hosting and final agent batches only, exercise all quickstart.md journeys live, record revision/backup/verification limits, merge into main, complete bridge and assess convergence in specs/004-personalized-chatbot/verification.md (FR-010, FR-013, SC-001 through SC-005).

## Dependencies and execution order

T001 -> T002 -> T003/T004 -> US1 T005-T011 -> US2 T012-T013 ->
US3 T014-T016 -> US4 T017-T020 -> T021-T022.
Within a combined TDD task, tests fail before code. Every remote mutation is
sequential and verified before the next batch. User explicitly requested small
increments. First milestone stops at T011 to report a usable live conversation.

Parallel opportunity: after T017, T018 cards and T019 timeline use separate files
and stable response contract; different teammates can own those tasks. Their
integration T020 is sequential. No parallel agent implementation is required.
Team procedure-data contributor owns curated fictional options/stages review;
chat owner works T005-T009/T013/T016; backend owner starts T002-T006; frontend
owner starts T010 and can then build cards/timeline against the agreed contract.
Assignments describe where work begins, not instructions to message teammates.

## Implementation strategy

Bridge inline execution with isolated worktree; canonical tasks only. Finish
US1 before additional features. Keep each remote batch rollback-ready, coordinate
fresh team pulls before touching shared files, preserve existing Firebase/group
resources, and report real service failures rather than local_demo success.
