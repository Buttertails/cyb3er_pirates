# Tasks: Account Reminder Emails

**Input**: `specs/009-email-reminders/spec.md`, `plan.md`, `research.md`, `data-model.md`, and `contracts/{api,email,landing}.md`.

Port source with `git show react-wip:<path>` / `git show stash@{0}:<path>`; never check out or apply them.

## Phase 1: Setup

- [ ] T001 Write the design doc and the spec 009 artifacts; point `.specify/feature.json` at `specs/009-email-reminders`; reconcile the spec 008 task checkboxes with the code present.
- [ ] T002 Pin `google-auth>=2.35.0,<3` in `backend/requirements.txt`. Add `backend/tests/reminder_fakes.py` (fake auth user, clock, monotonic, email sender, and an in-memory repository that uses the real `decide_*` rules).

## Phase 2: Foundational

- [ ] T003 Red-green: sign-in stores a UTC timestamp and a new `inactivity_cycle_id`; `GET /api/me` returns ISO strings; legacy strings still parse; bad values become `None`. Files: `backend/tests/test_user_routes.py`, `backend/dental/models.py`, `backend/store.py`, `backend/main.py`.
- [ ] T004 Red-green: `completed_care.with_confirmed_usage` (`backend/tests/test_completed_care.py`). `chat_routes._with_reports` delegates to it, and the chat tests stay green.
- [ ] T005 Red-green: `engine.unused_benefits_window` and `mock_plans.UNLIMITED_ANNUAL_MAX_CENTS` (`backend/tests/test_engine.py`).
- [ ] T006 Red-green: `backend/company_employees.py` stays in sync with `frontend/src/lib/demoEmployees.js`, `fixtures/demo.json` and `fixtures/dentists.json` (`backend/tests/test_company_employees.py`).
- [ ] T007 Red-green: `backend/email_delivery.py` templates, landing URL, and Resend sender error mapping including both kinds of 409, plus redaction and content privacy (`backend/tests/test_email_delivery.py`).
- [ ] T008 Red-green: `auth.require_scheduler` / `verify_google_id_token` (`backend/tests/test_reminder_routes.py`, auth cases).
- [ ] T009 Red-green: the `reminders.py` key format, 90-day boundary, and the `decide_claim` / `decide_sending` / `decide_sent` / `decide_failure` / `decide_skip` tables (`backend/tests/test_reminders.py`).

## Phase 3: User Story 1 — Inactivity reminder (P1)

- [ ] T010 [US1] Red-green: `ReminderRunner` and `InactivityCampaign`.
  - Sends once, then counts a finished record without an Auth lookup.
  - Each skip code; the `REMINDER_ALLOW_UNVERIFIED` flag; a stale cycle; a lease lost before sending; retryable failures.
  - The batch and time budget set `incomplete`; a dry run writes nothing.
  - Files: `backend/tests/test_reminders.py`, `backend/reminders.py`, `backend/reminder_campaigns.py`.
- [ ] T011 [US1] Red-green: the `FirestoreReminderRepository` transaction bodies and the sign-in backfill against a fake transaction.
  - A stale claim writes nothing; all reads happen before writes; a skip never overwrites `sent`; mark-sending checks the lease owner.
  - Files: `backend/tests/test_reminder_store.py`, `backend/store.py`.
- [ ] T012 [US1] Red-green: `POST /api/internal/reminders/run` body validation, 200 vs 503, redacted counts, and the legacy `/api/reminders` unchanged. Files: `backend/tests/test_reminder_routes.py`, `backend/reminder_routes.py`, `backend/main.py`.

## Phase 4: User Story 3 — Unused-benefits reminder (P1)

- [ ] T013 [US3] Red-green: `BenefitsCampaign` (`backend/tests/test_reminder_campaigns.py`, `backend/reminder_campaigns.py`, `backend/store.py`).
  - Pat and Lee qualify and Sam doesn't; the exact 10% boundary.
  - Confirmed care counts; window edges.
  - Unlimited or $0 maximums and unknown companies are excluded.
  - Recheck at claim; two emails when a user qualifies for both; once per plan year.

## Phase 5: User Stories 2 and 4 — Return flow and landing (P1/P2)

- [ ] T014 [US2] [US4] Red-green: `reminderFromSearch`, `signedInDestination` and `postSignInPlan` priority in `frontend/src/lib/accountNavigation.js` (`frontend/src/pages/AccountPages.test.jsx`). Wire them into the sign-in paths in `frontend/src/pages/AccountPages.jsx`.
- [ ] T015 [US4] Red-green: `formatPlanDate` and `benefitsReminderNote` in `frontend/src/lib/storage.js` (`frontend/src/lib/storage.test.js`). Add the one-time profile notice in `frontend/src/pages/ProfilePages.jsx`.
- [ ] T016 [US2] Red-green: `recordAccountCreated` in `frontend/src/lib/api.js` (`frontend/src/lib/api.test.js`). Record the baseline at account creation in `SignupPage`.

## Phase 6: Polish and operations

- [ ] T017 `backend/run_reminders.py` (`preview`, `run --dry-run | --sender log`, `backfill-sign-ins [--apply]`) with a production guard, tested in `backend/tests/test_reminder_cli.py`. Add the opt-in `backend/tests/test_reminder_emulator.py`.
- [ ] T018 Document configuration, Secret Manager, Resend domain, the dry-run-first Cloud Scheduler job and the backfill in `specs/009-email-reminders/quickstart.md`, `backend/README.md` and `README.md`.
- [ ] T019 Run the full backend and frontend suites, the frontend build, the email preview and the secret scan. Record evidence in `specs/009-email-reminders/verification.md`.

## Dependencies and independent checks

- T001–T009 come before the story work. T010–T012 complete US1; T013 completes US3; T014–T016 complete US2 and US4; T017–T019 follow.
- US1: a 90-day user receives one email; a repeat run sends none.
- US3: on 2026-10-04 the Pat- and Lee-mapped users receive one benefits email each and the Sam-mapped user none; a repeat run sends none.
- US2/US4: `?reminder=benefits` leads to the profile notice after onboarding or the stale update.
- MVP is US1 and US3, the two emails. US4 makes the benefits email actionable.
