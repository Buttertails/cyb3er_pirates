# Account reminder emails

## Goal

Bring signed-up employees back to the app at two moments that matter:

1. **Inactivity**: an employee who has not signed in for 90 days gets one email asking them to sign in and review their dental history. If nothing changed, confirming that takes a few seconds.
2. **Unused benefits**: in early October, an employee who has used almost none of this plan year's annual maximum gets one email reminding them that unused benefits reset at the end of the plan year.

This replaces the unfinished `react-wip` / `stash@{0}` work, numbered `003-dental-history-reminder` there, and carries it onto `main` as spec 009.

## Experience

- Both emails are short, transactional and privacy-minimal:
  - No dollar amounts, procedures, dates of care, user IDs or tracking.
  - One call to action that opens the normal sign-in page.
  - A note that this is a demonstration app with fictional plan data.
- **Inactivity email:**
  - Sent after the employee has gone 90 full days without signing in.
  - Points them to the existing stale-sign-in update ("Have you had any dental work since…?"), which already lets them answer that nothing changed.
  - The wording doesn't name a specific button, so it survives the planned recent-visits form redesign.
- **Benefits email:**
  - The window opens three months before the plan year ends (Oct 1 for calendar-year plans).
  - It goes only to employees with at least 90% of their annual maximum left.
  - The link carries `?reminder=benefits`. After sign-in, and after any onboarding or stale update, the employee lands on their profile, where a notice shows the remaining amount computed by the backend calculator.
- An employee who qualifies for both gets two separate emails.

## Scope boundaries (lean port)

**Reused:**
- main's stale-sign-in flow, which defers recording the sign-in until the update is finished
- main's employee-scoped completed-care store
- main's benefits calculator

**Ported from the earlier branch:**
- the Resend sender
- the reminder runner
- the Cloud Scheduler OIDC check
- per-cycle delivery records

**Not ported:**
- server-side review records
- sign-in event IDs
- procedure-submission markers
- the flat `users/{uid}/procedures` routes

## Operations

- A daily Cloud Scheduler job calls `POST /api/internal/reminders/run` on the direct Cloud Run URL with an OIDC token.
- Delivery stays disabled until the Resend key, sender, sign-in URL and scheduler identity are configured.
- Rollout starts with `{"dry_run": true}`.
- `REMINDER_ALLOW_UNVERIFIED` lets the demo email accounts that never verified their address, because sign-up doesn't send a verification email today.

## Verification

- Pure tests for the eligibility rules, the delivery state machine and the email content.
- Route tests for the scheduler identity and redacted responses.
- Vitest tests for the landing route and profile notice.
- An optional Firestore-emulator end-to-end check.
- No live email is sent without explicit approval.
