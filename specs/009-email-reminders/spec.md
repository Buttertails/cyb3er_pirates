# Feature Specification: Account Reminder Emails

**Feature Branch**: `main` (feature directory: `009-email-reminders`)
**Created**: 2026-10-04
**Status**: Approved design carried into specification
**Input**: `docs/superpowers/specs/2026-10-04-email-reminders-design.md`, which ports the unfinished `003-dental-history-reminder` work from `react-wip` and `stash@{0}`. User request: "I want the mails to not only be sent if they have the 90 day reminder, but also if they have a basically untouched account (full benefits) it should also remind them that they should use them, assume 2 months before the year ends (so like early october)."

## User Scenarios & Testing

### User Story 1 - Receive one timely inactivity reminder (Priority: P1)

An established user who has not signed in for 90 full days receives one email asking them to sign in and review their dental history.

**Why this priority**: The reminder brings inactive users back so their history, and the benefits figures built from it, stays current.

**Independent Test**: Seed a user whose last sign-in was exactly 90 days ago, run the reminder job, and confirm exactly one privacy-minimal email goes to that account's address. A second run sends nothing.

**Acceptance Scenarios**:

1. **Given** a user whose last recorded sign-in was at least 90 full days ago, **When** the daily job runs, **Then** one inactivity email is sent within 24 hours of eligibility.
2. **Given** a user already emailed for the current inactivity period, **When** later jobs run before their next recorded sign-in, **Then** no duplicate is sent.
3. **Given** any of the following, **When** the job runs, **Then** no email is sent:
   - a last sign-in less than 90 days ago
   - no recorded sign-in
   - a disabled account
   - no email address on the account
   - an unverified address while unverified delivery is not allowed

---

### User Story 2 - Return and confirm that nothing changed (Priority: P1)

A reminded user signs in and is taken through the existing recent-dental-work update. One clear answer confirms that nothing changed, and the sign-in is recorded only once the update finishes.

**Why this priority**: The smallest successful response to the email has to be quick.

**Independent Test**: Sign in as a user whose last sign-in is more than 90 days old, answer that nothing changed, and confirm the sign-in is recorded and a new inactivity period begins.

**Acceptance Scenarios**:

1. **Given** a stale user, **When** they sign in, **Then** the recent-dental-work update appears before their normal destination.
2. **Given** that update, **When** they answer that nothing changed, **Then** no procedure is created and their sign-in is recorded.
3. **Given** a stale user who leaves before finishing, **When** they come back, **Then** the update is offered again, and no second inactivity email is sent for the same period.

---

### User Story 3 - Receive an early-October unused-benefits reminder (Priority: P1)

A user who has at least 90% of this plan year's annual maximum left receives one email, once the reminder window opens (three months before the plan year ends), reminding them that unused benefits reset.

**Why this priority**: This is the new capability requested for this feature.

**Independent Test**: With the date inside the window, run the job for users mapped to Pat ($250 of $7,500 used), Lee ($500 of $12,000) and Sam ($7,400 of $7,500). Pat and Lee are each emailed once; Sam is not. A second run in the same plan year sends nothing.

**Acceptance Scenarios**:

1. **Given** a user whose company maps to a plan with a finite annual maximum, with at least 90% of it remaining and today on or after the window opening, **When** the job runs, **Then** one benefits email is sent for that plan year.
2. **Given** a user who has used more than 10% of the maximum, **When** the job runs, **Then** no benefits email is sent.
3. **Given** a date before the window opens, **When** the job runs, **Then** no benefits email is sent.
4. **Given** a user who qualifies for both reminders, **When** the job runs, **Then** they receive two separate emails.
5. **Given** a user who already received the benefits email this plan year, **When** later jobs run, **Then** no duplicate is sent. The next plan year is eligible again.

---

### User Story 4 - Land on remaining benefits after the email (Priority: P2)

The benefits email link brings the user, after sign-in, to their profile, where a notice states how much benefit is left and when it resets.

**Why this priority**: Amounts are deliberately left out of the email, so the app has to show them right away.

**Independent Test**: Open the sign-in page with `?reminder=benefits`, sign in as a non-stale demo user, and confirm the profile page shows the remaining-benefits notice once.

**Acceptance Scenarios**:

1. **Given** the benefits link, **When** a non-stale user signs in, **Then** they land on their profile with a notice showing the remaining amount and the reset date from the backend calculator.
2. **Given** the benefits link and a stale user, **When** they sign in, **Then** the recent-dental-work update comes first and then returns them to their profile.
3. **Given** a user still in onboarding, **When** they sign in from the link, **Then** onboarding comes first.
4. **Given** any other `reminder` value, **When** the page loads, **Then** it is ignored.

### Edge Cases

- **90-day boundary:** eligibility starts at exactly 90 elapsed 24-hour periods; one second earlier is not eligible.
- **Window dates:**
  - Sep 30 is outside the window; Oct 1 is inside.
  - Dec 31 is inside; Jan 1 starts a new plan year with a new key, and that year's window doesn't open until Oct 1.
- **Benefits threshold:** using exactly 10% of the maximum qualifies; one cent more does not.
- **Excluded from the benefits email:**
  - plans with no real maximum (the "unlimited" sentinel)
  - plans whose maximum is $0
  - a company of `other` or unknown, because the frontend's fallback numbers aren't theirs
- **Care added between the candidate query and the claim:** the claim rechecks eligibility inside a transaction, and no email goes out if the user no longer qualifies.
- **Company changed mid-run:** the claim is stale and no email is sent.
- **Overlapping or retried runs:** a 5-minute lease plus a deterministic delivery record ensure at most one successful handoff per period.
- **Transient provider failures:**
  - They are retried with the same idempotency key and the same message.
  - An uncertain failure older than 23 hours becomes `delivery_unknown` and is not resent.
  - A failure that is certain becomes permanent after 5 attempts.
- **Email changed between retries:** the payload differs, so Resend returns 409 `invalid_idempotent_request` and the delivery becomes permanently failed. This is accepted.
- **Legacy profiles:** those whose `last_sign_in_at` is still an ISO string aren't found by the job until backfilled or until their next sign-in.
- **Content:** emails never contain dollar amounts, procedures, care dates, user IDs or credentials, and the link doesn't skip sign-in.

## Requirements

### Functional Requirements

**Sign-in baseline**
- **FR-001**: The system MUST record the server time of each completed sign-in as a timestamp and start a new inactivity period identifier with it.
- **FR-002**: The system MUST record a baseline sign-in when an account is created.

**Inactivity eligibility**
- **FR-003**: A user MUST be eligible for the inactivity reminder once 90 full days have passed since their last recorded sign-in.
- **FR-004**: The system MUST send at most one inactivity reminder per inactivity period, including when runs overlap or retry.
- **FR-005**: The existing stale-sign-in update MUST remain the review experience. The sign-in MUST be recorded only after it finishes, so an unfinished review is offered again.

**Benefits eligibility**
- **FR-006**: The benefits reminder window MUST open three months before the end of the user's plan year and close at the plan-year end. The lead time is configurable.
- **FR-007**: A user MUST be eligible for the benefits reminder only when:
  - their company maps to a fictional employee whose plan has a finite, positive annual maximum
  - at least 90% of it remains, by the shared calculator and including confirmed care (threshold configurable)
  - the window is open
- **FR-008**: The system MUST send at most one benefits reminder per user per plan year.
- **FR-009**: The two campaigns MUST be independent: separate delivery records, separate idempotency keys and separate emails.

**Delivery checks**
- **FR-010**: Before sending, the system MUST recheck eligibility inside a transaction and skip candidates that changed.
- **FR-011**: The system MUST skip disabled accounts and accounts without an email. Unverified addresses MUST be skipped unless `REMINDER_ALLOW_UNVERIFIED` is enabled.

**Email content**
- **FR-012**: Each email MUST:
  - identify the app
  - ask the user to sign in
  - link to the normal sign-in page
  - include a privacy note and a fictional-data note
- **FR-013**: Each email MUST leave out dollar amounts, procedures, dates of care, user identifiers and credentials.
- **FR-014**: The benefits email link MUST carry only the allowlisted landing value `reminder=benefits`.

**Post-sign-in landing**
- **FR-015**: After sign-in from the benefits link, the app MUST give priority to onboarding, then to the stale update, and then show the profile with a notice of the remaining amount and reset date.

**Operations**
- **FR-016**: The reminder job MUST run only for the configured Cloud Scheduler service account, verified by an OIDC token with the configured audience.
- **FR-017**: The job MUST record, per delivery, non-sensitive status, attempt and failure details that operators can review without seeing email addresses or dental data.
- **FR-018**: The job MUST support a dry run that writes nothing and reports how many would be sent.
- **FR-019**: The job response MUST contain counts only. It MUST signal retry (503) when work was left incomplete or failed in a retryable way.
- **FR-020**: Provider credentials MUST come from the environment or Secret Manager and never be committed. Local tooling MUST refuse to touch production Firestore unless explicitly told to.

### Key Entities

- **User profile activity**: last recorded sign-in timestamp and current inactivity period identifier.
- **Reminder delivery**: one record per user, campaign and campaign key (inactivity period or plan-year start). It tracks lease, attempts, sent time, provider message ID and a non-sensitive failure code.
- **Benefits standing** (derived, not stored): plan-year start and reset date, window opening, annual maximum and amount used, computed from fixture usage plus confirmed care.
- **Reminder landing marker**: a browser-session value `reminder=benefits`, cleared after the profile notice has been shown.

## Success Criteria

### Measurable Outcomes

- **SC-001**: In tests, 100% of users at or past the 90-day boundary are selected and 0% one second before it.
- **SC-002**: Repeated and concurrent runs produce no duplicate delivery for the same user, campaign and key.
- **SC-003**: With demo data on 2026-10-04, the benefits campaign selects the Pat- and Lee-mapped users and not the Sam-mapped user.
- **SC-004**: 100% of rendered emails pass content checks: no `$`, amounts, procedure names, user IDs or keys, and exactly one sign-in link.
- **SC-005**: A user arriving from the benefits link sees the remaining-benefits notice on their profile after any required onboarding or stale update.
- **SC-006**: Operators can tell sent, skipped, retried, failed and unknown outcomes apart from delivery records and job counts alone.

## Assumptions

- Plan years for the fictional plans start on January 1, so the window opens on October 1. The logic still supports other start dates.
- One reminder per campaign period. Repeat nudges, unsubscribe preferences and bounce or complaint webhooks are out of scope for the demo.
- Firebase Authentication is the identity and email source at send time. The address isn't copied into delivery records.
- The company-to-employee mapping is the same fictional mapping the frontend uses, mirrored in the backend.
- Cloud Scheduler, Secret Manager and a verified Resend sending domain are manual setup steps that need the owner's approval.
- Live delivery starts in dry-run mode, and real sends are enabled only after the counts are reviewed.
