# Feature Specification: Persist profile and completed care

**Feature Branch**: `feat/cloud-profile-persistence`  
**Created**: 2026-10-03  
**Status**: Approved design; specification drafted  
**Source**: `docs/superpowers/specs/2026-10-03-cloud-profile-and-usage-persistence-design.md`

## User Scenarios & Testing

### User Story 1 - Keep a signed-in profile across devices (Priority: P1)

A signed-in user saves their name, selected company, dental office and location,
then signs in on another device and sees those same values. Updating location
does not erase other fields. A completed sign-in updates the 90-day reminder
marker.

**Independent Test**: Save profile fields, reload and change location, then
read the profile again as the same and a different account.

**Acceptance Scenarios**:
1. Given a signed-in account, saving a valid profile answer persists it across a
   new browser session and backend restart.
2. Given stored name/company/office, saving a new location keeps all three.
   Concurrent saves to different profile fields also preserve both changes.
3. Given an unavailable save, the page shows a retryable error and does not
   claim that cloud storage succeeded.
4. Given a second account, its profile does not expose the first account's data.

### User Story 2 - Record completed care and refresh benefits (Priority: P1)

A signed-in user selects a fictional employee, confirms completed dental care,
and sees that employee's remaining annual allowance update in live chat. The
user can revisit the record from another device. An estimate alone does not
change usage.

**Independent Test**: Record one procedure for Demo Company A, retry the same
submission, inspect chat and switch to a Demo Company C employee; compare the
balances and reread the record.

**Acceptance Scenarios**:
1. Given a selected fictional employee and a valid report with insurer payment,
   confirmation saves the report once and updates that employee's chat balance.
2. Given a retry of the same submission, the report and allowance count once;
   a conflicting retry is rejected without partially saving a batch.
3. Given a report without a known insurer payment, the history entry persists,
   but the app labels that payment unknown and does not invent a contribution.
4. Given another account or fictional employee, that user's reports do not
   change the current user's balance.
5. Given a planned estimate, starting or changing it does not create a report.
6. Given concurrent reports near the annual maximum, at most the allowed
   insurer-paid total is recorded.

### User Story 3 - See connected results without false local saves (Priority: P2)

The existing intake wizard keeps its temporary selections for navigation and
gets a result from the live estimate service. The profile and update screens
send supported answers to the cloud and report failures rather than silently
keeping them only on the current browser.

**Independent Test**: Complete the existing intake to a live estimate, then
simulate service failure; inspect error/retry and verify no fictional result is
shown as a connected estimate.

**Acceptance Scenarios**:
1. Given a supported intake selection, the result displays the connected
   estimate for the explicitly selected fictional employee, including that
   signed-in user's confirmed usage, and states its fictional assumptions.
2. Given an unavailable estimate service, the result page offers retry and does
   not show a locally generated financial result.
3. Given intake steps with no matching server event, the UI identifies them as
   browser-held selections and does not say they were sent to the backend.
4. Given prior browser-only care history, the profile still displays it as
   unverified local history and does not count it toward cloud usage.

### Edge Cases

Missing/expired sign-in; malformed profile fields; unknown fictional employee;
unsupported completed-care procedure; invalid or future service month; invalid
money; paid amounts greater than cost; an insurer payment that exceeds the
modeled allowance; duplicate and conflicting submission IDs; empty reports;
same account reporting for two demo employees; two accounts selecting the same
demo employee; changed fixture set; old chat session; database outage; stale
browser-only records; a failed live estimate.

## Requirements

### Functional Requirements

- **FR-001**: A signed-in user's name, selected company, office, location and
  completed sign-in marker persist independently across sessions and devices.
- **FR-002**: Partial and concurrent profile updates preserve other fields, and
  another account cannot read or change them through the application.
- **FR-003**: A completed-care report must be assigned to the signed-in account
  and an explicitly selected fictional employee with a known company plan.
- **FR-004**: Reports accept only supported completed-care procedures, a valid
  past or current service month, and valid optional nonnegative money amounts.
- **FR-005**: Repeating an identical submission records it once; an entire
  conflicting batch is rejected atomically without changing usage.
- **FR-006**: Only confirmed, known insurer payments contribute to recorded
  benefits usage. Concurrent reports cannot exceed the modeled allowance.
  Unknown payments remain labeled unknown; an estimate or skipped report
  contributes nothing.
- **FR-007**: The live chatbot uses the selected fictional employee's plan,
  fixture usage and the signed-in account's confirmed reports for that employee.
  Other accounts' and employees' reports are excluded.
- **FR-008**: Chat context binds the verified account, employee, fixture set and
  conversation; incompatible old contexts require an explicit restart.
- **FR-009**: Chat, result and profile screens use the explicitly selected
  fictional employee's plan and confirmed usage for compatible financial
  values from the same shared calculation and identify fictional assumptions.
- **FR-010**: Save and estimate failures are visible with retry; the interface
  never presents a local approximation as a successful cloud result.
- **FR-011**: Existing browser-only records remain visible as unverified local
  history and are not silently imported or counted as confirmed usage.
- **FR-012**: Existing accounts, group resources and cloud configuration remain
  available; the fix uses the existing deployment path and releases in small,
  verifiable increments.

### Key Entities

Signed-in account profile; fictional employee/company/plan selection; completed
care report with stable submission identity; known or unknown insurer payment;
recorded usage contribution; signed conversation context; connected estimate.

## Success Criteria

- **SC-001**: One user saves name, company and office, changes location, then
  retrieves all four after a fresh sign-in; a second user sees none of them.
- **SC-002**: One confirmed report survives reload and retry with exactly one
  usage contribution; a conflicting retry makes zero additional changes.
- **SC-003**: For two fictional employees under different company plans, chat
  shows the recorded contribution only for the employee and signed-in account
  that owns it, and an estimate leaves usage unchanged.
- **SC-004**: Every tested save/estimate failure shows an error or retry state,
  and zero tested failures display a fabricated successful result.
- **SC-005**: Existing login, location, live chat and unrelated profile screens
  continue to work after release.

## Assumptions and Boundaries

The approved design resolves account-to-demo-employee ownership by keeping
the explicit fictional employee selector and separating reports per account
and selected employee. A saved company label is not used to infer a plan.
Service month is represented by its first day for the current fictional plans'
January 1 year reset. Existing browser-only history remains visible locally
until a separately confirmed migration is designed. Appointment booking, real
claims, insurer enrollment, employer editing and automatic reports are outside
this feature.
