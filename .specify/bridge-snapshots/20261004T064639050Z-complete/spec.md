# Feature Specification: Nearby in-network dentists

**Feature Branch**: `main`
**Created**: 2026-10-04
**Status**: Approved design; specification drafted
**Source**: `docs/superpowers/specs/2026-10-04-nearby-dentists-design.md`

## User Scenarios & Testing

### User Story 1 - Find nearby dentists in chat (Priority: P1)

A signed-in employee asks to find dentists from the chat. The chat shows
fictional offices that belong to their current company plan's sample network,
nearest first using the ZIP saved in their account.

**Why this priority**: The ranked list is the core user value.

**Independent Test**: Sign in with a seeded ZIP and company, open the list in
chat, and inspect the order and company-plan membership.

**Acceptance Scenarios**:

1. Given a signed-in employee with a supported saved ZIP and company, when
   they choose Find in-network dentists, then the chat displays up to five
   matching offices ordered by approximate miles, nearest first.
2. Given two accounts with different company plans at the same ZIP, when each
   opens the list, then each sees only offices associated with their own plan.
3. Given an unauthenticated visitor, when they request the list, then no
   account-specific office list is returned.

### User Story 2 - Compare and locate an office (Priority: P2)

The employee reviews each result's address, sample rating, phone number and
approximate distance, then opens its location in a maps application.

**Why this priority**: The details let the employee act on the ranked list.

**Independent Test**: Open a result card and verify all details and the maps
link, including its destination coordinates.

**Acceptance Scenarios**:

1. Given a returned office, when its card is displayed, then name, address,
   sample rating, fictional phone, approximate miles and Open in Maps appear.
2. Given an office card, when Open in Maps is used, then a map location pin
   opens for that office's stored coordinates.
3. Given a fictional office, the interface does not present its sample rating,
   phone or network membership as independently verified real-world data.

### User Story 3 - Handle missing or unsupported locations (Priority: P3)

The employee gets a clear next step when their account has no ZIP, their ZIP
is outside the seeded test areas, or the directory cannot be reached.

**Why this priority**: A small sample directory must not invent nearby offices.

**Independent Test**: Try a missing ZIP, unsupported ZIP, no matching office
and a temporary service failure; inspect the message shown in chat.

**Acceptance Scenarios**:

1. Given no saved ZIP, when the employee asks for dentists, then the chat
   asks them to save a ZIP through the existing location flow.
2. Given an unsupported ZIP or no matching in-network office, the chat states
   that no sample office is available for that location and offers a retry
   after changing the location.
3. Given a temporary failure, the chat reports the failure and offers retry
   without displaying stale or fabricated results.

### Edge Cases

- Two offices at the same distance keep a stable order.
- A saved company without a mapped plan yields a clear no-results state.
- A changed account ZIP or company affects the next search.
- A state without a ZIP cannot be ranked.
- Invalid or incomplete office fixture records are rejected before display.
- The existing onboarding office picker cannot show contradictory addresses
  or distances for the same ZIP.

## Requirements

### Functional Requirements

- **FR-001**: Signed-in employees MUST be able to open a nearby in-network
  dentist list from the chat.
- **FR-002**: Results MUST use the requesting account's saved company and ZIP,
  with no employee or company selector.
- **FR-003**: Results MUST include only fictional offices associated with that
  company's single sample plan.
- **FR-004**: Results MUST be sorted by approximate distance from the saved
  ZIP, nearest first, with stable tie ordering and a maximum of five offices.
- **FR-005**: Each result MUST show office name, address, sample rating,
  fictional phone number, approximate distance, and a link to a map pin for its
  stored location.
- **FR-006**: The feature MUST distinguish sample provider details and
  unverified network membership from real provider information.
- **FR-007**: Missing ZIP, unsupported ZIP area, no matching office, unknown
  company plan, authentication failure, and temporary service failure MUST
  produce clear outcomes without fabricated results.
- **FR-008**: Office details and distance presented by the onboarding picker
  MUST agree with the directory for supported ZIPs; it MUST NOT fabricate an
  address by appending the employee's location to a generic street.
- **FR-009**: The directory MUST require no live provider service, driving
  directions service, or precise device location.

### Key Entities

- **Account context**: Signed-in employee's saved company and ZIP.
- **Company plan**: One sample plan per company and its sample network.
- **Fictional office**: Stable identity, name, address, map location,
  sample rating, fictional phone, and membership in one or more sample plans.
- **Supported ZIP area**: Saved ZIPs of current test accounts for which
  approximate location ranking is available.

## Success Criteria

### Measurable Outcomes

- **SC-001**: A test account in each seeded ZIP can open the ranked list from
  chat and see up to five results within three seconds under normal demo
  conditions.
- **SC-002**: In all tested company-plan combinations, zero displayed offices
  belong exclusively to another company's plan.
- **SC-003**: In every tested result, displayed distance is nondecreasing and
  name, address, rating, phone and map link are present.
- **SC-004**: In all four tested unavailable states—missing ZIP, unsupported
  ZIP, no matching office and temporary failure—the chat shows the relevant
  message and no invented office.
- **SC-005**: A map link from each seeded office opens the stored location,
  and existing login, profile and care chat flows continue working.

## Assumptions

- This is a sample provider directory for the current signed-in test accounts.
  North Carolina ZIP areas are included where present in those accounts.
- Approximate straight-line miles from ZIP center are adequate for ranking.
- Office names, ratings, phone numbers and network relationships are
  fictional. Maps links show a location pin, not a verified business listing.
- The existing signed-in profile holds the company and ZIP. Missing values
  are resolved through the current profile and location flow.
- Appointment availability, booking, real provider verification and nationwide
  coverage are outside this feature.
