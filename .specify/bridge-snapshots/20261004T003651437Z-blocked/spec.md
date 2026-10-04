# Feature Specification: Backend Chat Integration

**Branch**: `feat/backend-chat` | **Created**: 2026-10-03
**Status**: Approved design; backend implementation authorized.
**Input**: `docs/superpowers/specs/2026-10-03-backend-chat-integration-design.md`
and the user's explicit instruction to keep the team's Flask backend.
This feature implements a backend slice of 001; it does not replace the broader
dashboard, usage-persistence or comparison requirements in that feature.

## Clarifications

### Session 2026-10-03

- Keep the existing Flask API and calculator. Add chat and webhook adapters.
- Use separate fictional employees while the team's records are placeholders.
- Use expiring employee-bound context that works across cloud instances.
- Do not change login, provision storage, configure the remote agent, deploy,
  or make live conversation calls during this implementation.

## User Scenarios & Testing

### User Story 1 — Receive a contextual coverage estimate (P1)

An already insured fictional employee asks about one procedure, chooses a
network, receives calculated costs, and can change the choice to get a new result.

**Why this priority**: Supplies the missing backend for the first chat test.
**Independent test**: Exercise a complete guided exchange with a fake external
conversation service and real coverage calculations.

**Acceptance scenarios**:

1. Different companies' employees asking about the same procedure receive their
   own plan's results; employees at one company with different usage have
   different remaining allowances.
2. A changed network choice updates the result while keeping employee context.
3. Messages and structured results show the same calculator-produced amounts.
4. None of these requests writes completed usage.

### Edge Cases

Unknown employees, unsupported procedures/networks, invalid dates, malformed
requests, changed employee selection, forged or expired context, unauthorized
webhooks, missing configuration, conversation failures and webhook failures.

## Requirements

- **FR-001**: Resolve a selected fictional employee to exactly one company plan
  and their individual existing usage; reject invalid data and unknown IDs.
- **FR-002**: Create/reuse employee-bound conversation context across instances,
  reject tampering/expiry or employee mismatch, and create fresh context on restart.
- **FR-003**: Accept nonempty messages of at most 1000 characters or a supported
  start/restart action, without exposing credentials or accepting policy overrides.
- **FR-004**: Authenticate fulfillment requests and validate their conversation
  context before resolving policy or producing a financial result.
- **FR-005**: Use the existing shared calculator for one procedure and return
  insurer payment, employee cost, applicable assumptions and remaining allowance
  as both plain text and structured data. Estimates never write usage.
- **FR-006**: Missing or unsupported choices prompt for correction. Failed
  external calls return recoverable errors, without invented results or silent
  fallback. Never return a stale estimate after a fulfillment failure.
- **FR-007**: Preserve existing API behavior and keep teammate data templates,
  authentication, frontend and cloud resources intact.
- **FR-008**: Identify sample profiles, assumed rates and prices as fictional;
  demonstrate behavior with mocked external calls and report live verification
  separately.

### Key Entities

Company-to-plan mapping; fictional employee with individual usage; signed
conversation reference; validated procedure/network/date choices; read-only estimate.

## Success Criteria

- **SC-001**: One complete coverage exchange and a changed-network exchange
  return amounts that agree exactly with direct calculation.
- **SC-002**: At least two companies and two employees at one company produce
  correct distinct plan/usage results without mutating their source records.
- **SC-003**: Invalid authorization, context and choices never produce a
  financial estimate; service failures provide recoverable responses.
- **SC-004**: Existing backend verification remains passing, and implementation
  records clearly distinguish mocked verification from a live connection.

## Assumptions and Boundaries

Sample employee selection is public demo context, not real employee login.
Profile/usage persistence remains the separate whole-project requirement.
Policy-category rates already assumed by the team adapter remain unchanged and
are disclosed. One procedure only. Timing comparison, usage writes, UI integration,
live agent setup, paid requests and deployment are deferred.
