# Feature Specification: Personalized chatbot and benefits exploration

**Feature Branch**: `feat/personalized-chatbot`
**Created**: 2026-10-03
**Status**: Design approved; planning
**Input**: Expand the chatbot substantially with personalized alternatives,
policy-reset scheduling, interactive what-if cards and a benefits timeline.
**Source**: docs/superpowers/specs/2026-10-03-personalized-chatbot-expansion-design.md

## User Scenarios & Testing

### User Story 1 - Complete and revisit a coverage conversation (Priority: P1)

An already insured employee explores one planned procedure, understands current
coverage and cost, and asks follow-up questions without repeating known answers.
**Why this priority**: The live conversation is the foundation for every extra.
**Independent Test**: Complete an estimate from the website, interrupt intake
with a benefits question, change network, then return to the original treatment.

**Acceptance Scenarios**:
1. Given a selected employee and company, starting chat shows that context and
   the remaining benefits; only missing procedure/network information is asked.
2. Given a supported procedure and network, the employee sees coverage, cost,
   deductible, remaining benefits and assumptions consistent with the estimate.
3. Given an interrupted question, help or terminology answers resume that step.
4. Given an existing case, changes preserve unrelated answers; a new case or
   employee context explicitly resets the old treatment and comparisons.
5. Given a service failure, the last valid result stays visible as previous,
   retry is offered, and no successful conversation is falsely reported.

### User Story 2 - Explore affordable treatment options (Priority: P2)

An employee supplies an optional budget and explores curated alternatives for a
planned treatment, including partial or absent coverage.
**Why this priority**: Cost alternatives make the conversation personally useful.
**Independent Test**: Compare one treatment with a curated option under two
companies and different usage, including a no-covered-option case.

**Acceptance Scenarios**:
1. Given curated options, comparisons show each option's plan payment, employee
   cost, reasons and budget fit under the selected employee's actual demo plan.
2. Given an excluded treatment, a cheaper option is not described as covered
   unless that option's own policy calculation says so.
3. Given no supported option, the assistant explains the limitation and offers
   network/timing exploration or questions for the dentist.

### User Story 3 - Compare permitted schedules around a reset (Priority: P2)

An employee provides a preferred date and any dentist deadline, then compares
current-year and permitted later care or stages across a policy reset.
**Why this priority**: Timing can make the annual allowance easier to use.
**Independent Test**: Compare a stageable case across reset and a nonstageable
case, including lifetime-limit and deadline examples.

**Acceptance Scenarios**:
1. Given supported stages, comparison preserves ordering and timing constraints
   and shows dated costs and allowances for each affected policy year.
2. Given a lifetime limit, an annual reset does not replenish that limit.
3. Given no savings or a deadline blocking deferral, the assistant says so and
   excludes infeasible dates; installments alone never create coverage.

### User Story 4 - Explore cards and a benefits timeline (Priority: P2)

The employee changes a scenario directly in the interface and sees how costs
and projected remaining benefits change alongside their recorded care.
**Why this priority**: A visible comparison makes the demo understandable.
**Independent Test**: Change network/date/option, view the updated timeline,
restore the baseline and confirm that recorded usage is unchanged.

**Acceptance Scenarios**:
1. Given an estimate, cards show baseline and changed scenario totals and the
   difference, with assumptions; controls retain unrelated preferences.
2. Given recorded care and proposed stages, the timeline distinguishes recorded
   entries, projections and policy reset, grouped by policy year.
3. Given changed choices, card, chat and timeline agree for the same scenario;
   restoring baseline restores all three without creating usage records.

### Edge Cases

Unknown procedure, ambiguous procedure, unknown network, blank/invalid budget,
invalid/past date, deadline earlier than requested care, excluded category,
exhausted allowance, lifetime orthodontic limit, invalid stage definitions,
no cheaper option, no savings, conflicting procedure aliases, expired session,
changed fixture set, duplicate message/retry, out-of-order scenario replies,
service timeout and questions about changing insurance. Unsupported situations
must explain the issue and offer supported choices, never fabricate a result.

## Requirements

### Functional Requirements

- **FR-001**: Offer coverage, estimate, options, timing and usage entry points and
  reusable help, menu, back, change-answer, why and new-case navigation.
- **FR-002**: Keep one active treatment case with known procedure, network,
  optional budget, preferred date and dentist deadline; preserve unrelated
  answers and resume interrupted steps. Ask only for missing required values.
- **FR-003**: Use the employee's company plan and employee-specific recorded usage;
  explicitly identify fictional demo context, never infer it from login alone.
- **FR-004**: Explain eligibility, excluded/partial coverage, deductible, plan
  payment, employee cost and projected remaining benefits with assumptions.
- **FR-005**: Calculate all financial outputs from one shared benefit model;
  chat, cards and timeline must agree and estimates must not alter recorded usage.
- **FR-006**: Compare only curated options, state applicability assumptions and
  dentist confirmation, show budget fit and report unsupported/no-cheaper cases.
- **FR-007**: Compare dated treatment/stage schedules only when supported by
  supplied policy rules and stage definitions; enforce ordering/windows/deadline,
  distinguish annual from lifetime limits and report no savings honestly.
- **FR-008**: Provide interactive network/date/option comparisons with baseline,
  scenario and differences; restore baseline and retain unrelated preferences.
- **FR-009**: Show a timeline of recorded care, proposed care and policy resets,
  with explicit recorded/projected labels and per-year benefits summaries.
- **FR-010**: Use a working website conversation and real conversation service;
  preserve login and current team screens, and expose unavailable/expired-session
  states with retry/restart. Never present browser placeholders as live results.
- **FR-011**: Protect conversation context and webhook access, reject forged
  identity/financial overrides, retain private credentials outside browser/Git.
- **FR-012**: Handle ambiguity, fallback and insurance-change questions in plain
  language with useful supported choices and return to the active case.
- **FR-013**: Release small reviewable increments with remote-agent backups,
  rollback and truthful local/live verification; preserve existing group resources.
- **FR-014**: Support labeled controls and keyboard access, pending/error states,
  one active message submission and reject stale scenario replies.

### Key Entities

Employee/company/plan context; recorded usage; treatment case/preferences;
curated treatment option; ordered service stage; dated scenario result; timeline
entry; conversation navigation state. Options and stages reference supported
procedures. Every projected result belongs to an employee, case and scenario.

## Success Criteria

### Measurable Outcomes

- **SC-001**: Complete 2 live website journeys for different company policies,
  one including help-and-resume and another changing a previously supplied answer.
- **SC-002**: In 6 representative comparisons (covered, partial, excluded,
  exhausted, lifetime-limited and no-savings), chat/card/timeline amounts match
  exactly and recorded usage remains unchanged.
- **SC-003**: Show 1 feasible cross-reset schedule, 1 deadline-blocked comparison
  and 1 lifetime-limit comparison with no unsupported reset savings.
- **SC-004**: Change and restore at least 3 scenario controls without repeating
  known intake; show matching timeline updates and prevent stale-result overwrite.
- **SC-005**: Every simulated unsupported request and service/session failure
  provides a recovery choice; no private credential or financial override is
  accepted from the browser and existing login checks continue to pass.

## Assumptions and Clarifications

- User approved the written design and selected chatbot + what-if + timeline.
- Existing fictional company policies and employee usage are authoritative demo
  inputs. Exactly one plan per company. Simplified rules are explicitly labeled.
- Optional budget/timeframe can be skipped; missing preferred date defaults to
  the displayed demo reference date, not an undisclosed date.
- Demo employee selection is explicit, separate from the signed-in account;
  missing real employer mapping does not silently select a company for that user.
- The team's browser-stored procedure history is not automatically imported into
  authoritative usage. Existing update screens remain; persistence migration,
  live claims, booking, employer editing, enrollment, diagnosis and PDF export
  are outside this feature. Supplied stage data is fictional planning data.
- English-only hackathon demo. No throughput or uptime guarantee. Existing cloud
  resources and authorized project charges are reused; unrelated changes require
  surfacing the actual requirement. TDD and bridge discipline apply.
