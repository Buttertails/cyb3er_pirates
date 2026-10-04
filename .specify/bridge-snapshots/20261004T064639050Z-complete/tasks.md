# Tasks: Nearby in-network dentists

**Input**: [spec.md](spec.md), [plan.md](plan.md), [research.md](research.md),
[data-model.md](data-model.md), [contract](contracts/nearby-dentists.md)

**Tests**: Required for ranking, authenticated filtering and visible chat
behavior by the project constitution and approved design. Write failing tests
before product code.

## Phase 1: Setup

**Purpose**: Reuse current deployment and account context without adding a
new provider service.

- [x] T001 Inspect distinct saved ZIPs and company IDs of current Firebase test accounts read-only, retaining no names/emails/UIDs; select the small supported ZIP set, including North Carolina where present, for `backend/fixtures/dentists.json`.

## Phase 2: Foundational

**Purpose**: Establish a validated sample directory and account-context
contract used by the stories.

- [x] T002 Write failing fixture validation and raw-distance ordering tests in `backend/tests/test_dentists.py`; cover unique IDs, finite coordinates, 0–5 rating, reserved fictional US phone, known plan IDs, ZIP/state consistency, and stable equal-distance ties.
- [x] T003 Create versioned office and ZIP-center records for the selected test areas in `backend/fixtures/dentists.json`; include no user identifiers, names or emails.
- [x] T004 Implement fixture loading, validation, company-plan filtering and Haversine sorting in `backend/dental/dentists.py`; return at most five offices, sort unrounded distance then ID, and display one-decimal approximate miles.

**Checkpoint**: A pure backend lookup can rank validated fictional offices.

## Phase 3: User Story 1 - Find nearby dentists in chat (Priority: P1) 🎯 MVP

**Goal**: Show an authenticated, plan-matched ranked list inside the signed-in
chat.

**Independent Test**: Two accounts on different company plans at a supported
ZIP see only their own plan's nearest offices.

- [x] T005 [US1] Write failing authentication, saved-profile context, plan isolation, and five-result contract tests for `GET /api/me/dentists` in `backend/tests/test_user_routes.py`.
- [x] T006 [US1] Add `GET /api/me/dentists` in `backend/main.py`; derive UID, company and ZIP from the verified profile, never request parameters, and return the contract shape from `specs/006-nearby-dentists/contracts/nearby-dentists.md`.
- [x] T007 [US1] Write failing signed-in request tests in `frontend/src/lib/api.test.js`; verify no demo employee or company override is sent.
- [x] T008 [US1] Add the authenticated nearby-dentists request to `frontend/src/lib/api.js` and a Find in-network dentists action/result state in `frontend/src/pages/LiveBenefitsChat.jsx`; keep it in chat and disable duplicate requests.

**Checkpoint**: The user can retrieve the correct sorted list in chat.

## Phase 4: User Story 2 - Compare and locate an office (Priority: P2)

**Goal**: Make each office result useful and accurately labeled.

**Independent Test**: A returned card shows all six details and opens its
stored map pin.

- [x] T009 [US2] Write failing result-card tests in `frontend/src/components.test.jsx`; cover name, address, sample rating, fictional phone, approximate miles and map link coordinates.
- [x] T010 [US2] Render reusable sample office cards in `frontend/src/components.jsx` and responsive styling in `frontend/css/styles.css`; label sample data and link to the stored map pin.

**Checkpoint**: A listed office has complete details and a working location
link.

## Phase 5: User Story 3 - Missing or unsupported locations (Priority: P3)

**Goal**: Handle the sample directory's limits without invented offices.

**Independent Test**: Missing ZIP, unsupported ZIP, unknown plan, no matching
office and service failure each show the correct chat state.

- [x] T011 [US3] Write failing backend outcome tests in `backend/tests/test_user_routes.py`, frontend response/error tests in `frontend/src/lib/api.test.js`, and presentational empty/error state tests in `frontend/src/components.test.jsx` using the installed React server renderer; ensure no stale or fabricated list is shown.
- [x] T012 [US3] Implement explicit directory outcomes and retry/sign-out states in `backend/main.py` and `frontend/src/pages/LiveBenefitsChat.jsx`, with no fallback provider generation.
- [x] T013 [US3] Write failing onboarding consistency tests in `frontend/src/lib/chatScript.test.js`, then replace generic address/distance generation in `frontend/src/lib/api.js` and `frontend/src/lib/chatScript.js` with directory results for supported ZIPs; preserve clear no-results behavior elsewhere.

**Checkpoint**: All unavailable states and the onboarding picker agree with
the ranked directory.

## Phase 6: Verification and release

- [x] T014 Run backend pytest, frontend tests and production build; verify directory ranking, map links and the absence of a demo employee selector through focused automated checks; record evidence in `specs/006-nearby-dentists/verification.md`.
- [x] T015 Deploy the tested API and React assets through the existing Cloud Run and Firebase Hosting path; verify live health, deployed asset revision and a working rollback revision in `specs/006-nearby-dentists/verification.md`.

## Dependencies and execution order

T001 determines fixture ZIPs. T002 precedes T003–T004. T004 precedes backend
T005–T006. T006 precedes frontend T007–T008. T008 precedes T009–T010 and
T011–T013. T014 follows all desired stories; T015 follows T014.

Independent work after T004: frontend card tests (T009) and authenticated route
tests (T005) touch different files. Do not run tests and implementation for the
same story in parallel: tests must fail first.

## Implementation strategy

Deliver US1 as the first usable chat result, then add card details (US2) and
empty/onboarding consistency (US3). Verify and release only after all three
stories pass. The bridge updates only these canonical task checkboxes.
