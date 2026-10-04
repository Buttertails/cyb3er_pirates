# Research: Account Reminder Emails

## D1. How much of the earlier work to port

- **Decision**: A lean port.
  - From `react-wip`: the Resend sender, the runner and its tests.
  - From `stash@{0}`: the scheduler OIDC check, the delivery repository design and the internal route.
  - Reuse main's stale-sign-in update and its completed-care store.
- **Rationale**: Since the earlier work, main has grown its own 90-day update flow and an employee-scoped care store. The stash's flat `users/{uid}/procedures` routes, review records and sign-in event IDs would collide with both.
- **Alternatives**: Port the full stash design. Rejected by the owner: roughly twice the work, and two procedure stores to keep in sync.

## D2. Storing the sign-in time

- **Decision**: Write `last_sign_in_at` as a Firestore timestamp, plus a new `inactivity_cycle_id` (UUID) on every recorded sign-in.
  - Reads accept old ISO strings.
  - `GET /api/me` keeps returning an ISO string.
  - A preview-first CLI backfill converts old string values.
- **Rationale**: Firestore range queries don't match strings against timestamps. The field first appeared on 2026-10-04 (bbfc6b1), so the backfill is small. The cycle ID gives each inactivity period a stable key.
- **Alternatives**: Keep the strings. Rejected: string ordering is fragile. Rely only on a lazy upgrade at next sign-in. Rejected: users who never return would never be reminded.

## D3. Scheduling

- **Decision**: A daily Cloud Scheduler HTTP job.
  - Sends a POST with an OIDC token to the **direct** Cloud Run URL, path `/api/internal/reminders/run`.
  - Flask checks the token audience and the exact service-account email.
- **Rationale**: Nothing to run besides the existing service, and no shared secret to rotate. Hosting also forwards `/api/**`, but the identity check still guards the route.
- **Alternatives**: A shared-secret header (rotation and leak risk), a separate Cloud Function (more to deploy), an in-process timer (Cloud Run scales to zero).

## D4. Email provider

- **Decision**: Resend `POST https://api.resend.com/emails` through `urllib`, with an `Idempotency-Key` header and an identical body on every retry.
  - A 409 response is split by its `name`:
    - `concurrent_idempotent_requests` is retryable and treated as uncertain.
    - `invalid_idempotent_request` is permanent.
- **Rationale**: One HTTPS call needs no SDK. Resend deduplicates on the same key and payload for 24 hours.
- **Alternatives**: SMTP, SendGrid, or the Resend SDK. These add dependencies without improving correctness.

## D5. Delivery state machine

- **Decision**:
  - One record per `{campaign}-{key}` at `users/{uid}/reminder_deliveries`.
  - Statuses: `skipped_auth`, `claimed`, `sending`, `sent`, `retryable_failed`, `permanent_failed`, `delivery_unknown`.
  - Finished states: `sent`, `permanent_failed`, `delivery_unknown`.
  - Lease: 5 minutes.
  - An uncertain or interrupted send becomes `delivery_unknown` 23 hours after the first attempt.
  - A send that definitely failed becomes permanent after 5 attempts.
  - A skip never overwrites a finished or leased record.
  - Each transition is a pure `decide_*` function, applied inside Firestore transactions.
- **Rationale**: Gives at-most-once successful handoff inside Resend's idempotency window. Pure functions let the in-memory test repository use the real rules. This fixes four bugs in the stash:
  - a skip could overwrite `sent`
  - `mark_sending` ran outside a transaction
  - a leased claim was counted as terminal
  - the test double had its own copy of the state machine

## D6. Two campaigns, one pipeline

- **Decision**:
  - `InactivityCampaign` (key: the cycle ID) and `BenefitsCampaign` (key: the plan-year start date) share the runner and repository.
  - One endpoint runs inactivity first, then benefits.
  - Each campaign sends at most 25 per run, under a shared 45-second time budget.
- **Rationale**: The owner wants separate emails. Shared delivery code avoids two state machines. The time budget keeps a run under Cloud Run's 60-second request timeout.

## D7. What "basically untouched" means

- **Decision**: At least 90% of the annual maximum remaining this plan year, checked in integer cents as `(max − used) × 100 ≥ 90 × max`.
  - The threshold is configurable (`REMINDER_BENEFITS_REMAINING_PERCENT`).
  - Plans with the unlimited sentinel or a $0 maximum are excluded.
- **Rationale**: Chosen by the owner. It tolerates a cleaning or two. "Used" comes from the shared calculator (constitution principle II): fixture usage plus confirmed care with known insurer payments.

## D8. When the benefits window opens

- **Decision**:
  - The window opens at plan-year end minus `REMINDER_BENEFITS_LEAD_MONTHS` (default 3), clamping the day of the month, and closes at plan-year end.
  - Calendar-year plans open on Oct 1.
  - The key is the plan-year start date, so each user gets one email per plan year.
- **Rationale**: The owner chose "early October". Defining it relative to the plan year keeps non-January plans correct.

## D9. Email content

- **Decision**: Neither email includes amounts.
  - The benefits email says the user still has most of their benefits for the `{plan year}` and names the reset date.
  - Both emails include a privacy note and a fictional-data note, escape all HTML, and carry no images or tracking.
  - The inactivity wording doesn't name UI buttons.
- **Rationale**: The owner declined amounts in email. The planned recent-visits form redesign would make button names go stale.

## D10. Unverified addresses

- **Decision**: Verified-only by default. `REMINDER_ALLOW_UNVERIFIED=true` lets the demo send to unverified addresses. Disabled accounts and accounts without an email are always skipped.
- **Rationale**: Sign-up doesn't send a verification email today, so every account is unverified. The owner chose a flag over adding verification.

## D11. Company-to-employee mapping on the backend

- **Decision**: `backend/company_employees.py` mirrors `frontend/src/lib/demoEmployees.js`, with **no default**: `other` and unknown companies are excluded. A sync test parses the JS file.
- **Rationale**: Only the frontend held this mapping. `.gcloudignore` deploys `backend/*.py` but only two named JSON fixtures, so a Python module ships with no deploy change.

## D12. Benefits landing

- **Decision**:
  - The email link appends `?reminder=benefits`.
  - The sign-in page reads only allowlisted values (`Object.hasOwn`) and saves them as a session step.
  - After onboarding or the stale update, the user goes to the profile page, which shows a `.note` with backend-computed amounts once.
- **Rationale**: Deep links don't survive the flow guard, so the marker has to persist in session storage. The allowlist prevents an open redirect.

## D13. Safe local tooling and rollout

- **Decision**: `backend/run_reminders.py` offers `preview`, `run --dry-run | --sender log` and `backfill-sign-ins [--apply]`.
  - Any command that touches Firestore refuses to run without `FIRESTORE_EMULATOR_HOST` unless given `--allow-production`.
  - The Scheduler job starts with `{"dry_run": true}`.
- **Rationale**: The repo-root admin key is loaded automatically and points at production. Today (Oct 4) is already inside the benefits window, so the first live run would send immediately.
