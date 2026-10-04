# Cross-artifact analysis

| Requirement | Story | Tasks |
|---|---|---|
| FR-001 sign-in timestamp and cycle | US1, US2 | T003 |
| FR-002 baseline at account creation | US2 | T016 |
| FR-003, FR-004 inactivity eligibility, once per period | US1 | T009, T010, T011 |
| FR-005 existing stale update stays the review | US2 | T014 (routing priority), verified with existing `chatScript` tests |
| FR-006, FR-007 benefits window and threshold | US3 | T005, T013 |
| FR-008 once per plan year | US3 | T009, T013 |
| FR-009 independent campaigns | US1, US3 | T009, T013 |
| FR-010 transactional recheck | US1, US3 | T011, T013 |
| FR-011 account skips and unverified flag | US1, US3 | T010 |
| FR-012, FR-013 email content | US1, US3 | T007 |
| FR-014 allowlisted landing value | US4 | T007, T014 |
| FR-015 landing priority and notice | US4 | T014, T015 |
| FR-016 scheduler identity | ops | T008 |
| FR-017 non-sensitive delivery records | ops | T009, T011 |
| FR-018 dry run | ops | T010, T012, T017 |
| FR-019 counts only, 503 to retry | ops | T012 |
| FR-020 secrets and production guard | ops | T017, T018, T019 |

- The plan, data model and both contracts agree on:
  - the `{campaign}-{key}` delivery ID
  - the 5-minute lease and the 23-hour finalization
  - 25 sends per campaign and the 45-second budget
  - the 90% / 3-month defaults
- Deviations from the earlier `003-dental-history-reminder` draft are intentional:
  - no server-side review records
  - no sign-in event IDs
  - a single internal route for both campaigns
- No unresolved requirement or constitutional conflict remains.
