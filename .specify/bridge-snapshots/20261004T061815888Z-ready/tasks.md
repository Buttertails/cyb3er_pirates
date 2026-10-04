# Tasks: Cloud profile and completed care

**Input**: [spec.md](spec.md), [plan.md](plan.md), [contracts/api.md](contracts/api.md), [data-model.md](data-model.md)

## Phase 1: Profile persistence (US1)

- [x] T001 [US1] Add failing tests for profile merge, validation, separate accounts, and sign-in marker in `backend/tests/test_user_routes.py`.
- [x] T002 [US1] Extend account profile storage and authenticated Flask routes in `backend/store.py` and `backend/main.py`; preserve location and unrelated fields with merge writes.
- [x] T003 [US1] Verify profile tests and existing location/login behavior; wire profile details and sign-in calls in `frontend/js/api.js` without false browser fallback, and add focused frontend test.

## Phase 2: Confirmed completed care (US2)

- [x] T004 [US2] Add failing validation/idempotency/isolation tests for report API and usage conversion in `backend/tests/test_user_routes.py` and a new `backend/tests/test_completed_care.py`.
- [x] T005 [US2] Implement validated account/employee-scoped report storage and `GET/POST /api/me/procedures` in `backend/store.py`, `backend/main.py`, and a small validation module; maintain stable retries and unknown payment semantics.
- [x] T006 [US2] Add failing tests for UID-bound session, account-specific report aggregation, and matching chatbot/webhook estimates in `backend/tests/test_chat_context.py` and `backend/tests/test_chat_routes.py`.
- [x] T007 [US2] Bind `/api/chat` to verified Firebase UID and use confirmed report usage in both chat and webhook via `backend/chat_context.py` and `backend/chat_routes.py`; reject old UID-free sessions with restart guidance.
- [x] T008 [US2] Add explicit fictional employee selection and stable submission IDs to `frontend/procedures.html`, `frontend/js/procedures.js`, and `frontend/js/api.js`; connect history to same employee and show unknown payment honestly.

## Phase 3: Connected frontend results (US3)

- [x] T009 [US3] Add focused frontend tests for live profile/report failures and estimate failure in `frontend/tests/`.
- [x] T010 [US3] Remove false cloud-success fallbacks for profile/location/report and connected estimate in `frontend/js/api.js` and `frontend/js/estimate.js`; keep unsupported wizard step events clearly browser-held.

## Phase 3A: Review corrections

- [x] T013 [US1] Reproduce concurrent profile field loss with a failing repository/route test, then change `backend/store.py` and `backend/main.py` to merge only supplied fields.
- [x] T014 [US2] Add failing tests for concurrent annual-cap submissions and all-or-nothing conflicting batches; implement one Firestore transaction for each batch and plan-year totals in `backend/store.py` and `backend/main.py`.
- [x] T015 [US3] Add failing tests for a selected Company C employee's live benefits/estimate and an estimate that does not write usage; add authenticated `/api/me/benefits` and `/api/me/estimate` routes backed by the shared engine.
- [x] T016 [US3] Add failing frontend tests for selected-employee result requests and retained, labeled browser-only history; update `frontend/js/estimate.js`, `frontend/js/results.js`, `frontend/js/profile.js` and related pages.

## Phase 4: Verification and cloud delivery

- [x] T011 Run full backend/frontend tests, validate spec scenarios for two accounts and two company plans, and review changes for credential or resource mutations; record evidence in `specs/005-cloud-profile-persistence/verification.md`.
- [x] T012 Deploy the tested Flask revision to the existing Cloud Run service and static assets to the existing Firebase Hosting site; verify health, asset delivery, and rollback revision in `specs/005-cloud-profile-persistence/verification.md`.

## Dependencies

T001→T002→T003; T004→T005; T006→T007 and T005→T007; T005→T008; T009→T010; T013/T014/T015/T016 follow the review findings and precede T011. T003/T007/T008/T010/T013/T014/T015/T016→T011→T012. Tests precede implementation for each behavior change. No task creates or deletes a Firebase resource.
