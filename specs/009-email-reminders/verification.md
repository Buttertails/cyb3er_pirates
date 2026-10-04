# Verification: Account Reminder Emails

**Date**: 2026-10-04 | **Branch**: `main` (local commits, not pushed)

## Automated checks

| Check | Command | Result |
|---|---|---|
| Backend full suite | `cd backend && venv/bin/python -m pytest` | 418 passed, 1 skipped (emulator suite; see below) |
| Reminder-focused suites | `venv/bin/python -m pytest tests/test_email_delivery.py tests/test_reminders.py tests/test_reminder_campaigns.py tests/test_reminder_store.py tests/test_reminder_routes.py tests/test_company_employees.py tests/test_user_routes.py tests/test_engine.py tests/test_reminder_cli.py tests/test_completed_care.py tests/test_reminder_emulator.py` | 245 passed, 1 skipped |
| Frontend | `cd frontend && npm test` | Vitest 49 passed; node tests 5 passed |
| Frontend build | `npm run build` | built |
| Secret scan | `git grep -nE "re_[A-Za-z0-9]{16,}"` plus the same pattern over new files | no matches |

The baseline before this feature was 230 backend tests passing.

## Email preview

`venv/bin/python run_reminders.py preview --as-of 2026-10-04`:

- **Inactivity email** ("Please review your dental profile"): a sign-in link only; no amounts or history.
- **Benefits email** ("Your dental benefits reset soon"): names the 2026 plan year and the reset on January 1, 2027, and links to `…/index.html?reminder=benefits`; no amounts.
- **Demo standing on 2026-10-04** (window opens 2026-10-01):

  | Employee | Annual maximum left | Result |
  |---|---|---|
  | demo-a-pat | 96.7% | qualifies |
  | demo-c-lee | 95.8% | qualifies |
  | demo-a-sam | 1.3% | does not qualify |

  This matches SC-003.

## Browser check (Vite dev server)

- `/index.html?reminder=benefits` shows "Sign in to see how much of your dental benefit is left."
- `/index.html?reminder=__proto__` shows nothing extra.
- No console errors.

## Not run here

- **Firestore/Auth emulator end-to-end** (`tests/test_reminder_emulator.py`, `run_reminders.py run`). This machine has only Java 8; firebase-tools 15 needs Java 21. The suite is ready and skips itself without a `demo-` emulator project.
- **Signed-in landing on Profile.** The local frontend authenticates against the production Firebase project, so no test sign-in was performed. `postSignInPlan` and `benefitsReminderNote` are unit-tested.
- **Deployment, Secret Manager, Resend domain, Cloud Scheduler, and a live send.** These are owner-approved manual steps in `quickstart.md`, and the rollout starts with `{"dry_run": true}`.
