# Feature Specification: Dental Benefits Assistant

**Feature Branch**: `main` (spec directory is independent of branch)
**Created**: 2026-10-03
**Status**: Draft — clarification pending
**Input**: Approved design at
`docs/superpowers/specs/2026-10-03-dental-benefits-assistant-design.md`
and the approved conversational decisions. The user approved the written
design on 2026-10-03.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Understand current procedure coverage (Priority: P1)

An already insured employee opens their benefits dashboard, describes a needed
procedure in a guided conversation, and receives a plain-language estimate
based on their own company's plan and their existing benefits usage.

**Why this priority**: This is the challenge's central user benefit and the
smallest complete demonstration.

**Independent Test**: Select a fictional employee, describe a supported
procedure, and check the displayed coverage, cost shares, and remaining allowance.

**Acceptance Scenarios**:

1. **Given** employees at two companies with different plans, **When** each asks
   about the same procedure, **Then** the results reflect each company's plan.
2. **Given** employees sharing a company but with different existing usage,
   **When** they estimate a procedure, **Then** each estimate uses their own allowance.
3. **Given** a supported procedure, **When** an estimate is produced, **Then**
   the employee sees procedure cost, insurer contribution, employee share,
   a plain-language explanation, and the applicable assumptions.
4. **Given** an estimate, **When** the employee views the dashboard, **Then**
   it agrees with the conversation and recorded usage has not changed.

---

### User Story 2 - Compare practical care options (Priority: P2)

The employee explores alternative treatment dates and, where data is available,
network options under the current plan.

**Why this priority**: Helps the employee act on the estimate and demonstrates
the challenge's benefit optimization goal.

**Independent Test**: Compare a supported procedure before and after the
fictional plan's annual reset using an employee with partially used benefits.

**Acceptance Scenarios**:

1. **Given** partial benefit usage, **When** current-year and following-year
   treatment are compared, **Then** both cost shares are visible and the reset
   and continuing-plan assumptions are explained.
2. **Given** fictional prices and coverage for both network options, **When**
   the employee requests a comparison, **Then** the results use the supplied
   prices and coverage without inventing provider information.
3. **Given** missing network data, **When** comparison is requested, **Then**
   the employee is told what information is unavailable and can continue.
4. **Given** a needed procedure, **When** timing is compared, **Then** financial
   options are presented without asserting that delaying treatment is safe.

---

### User Story 3 - Track benefits utilization (Priority: P3)

The employee sees their annual allowance, existing usage, and remaining benefits,
and can understand how completed care affects those values.

**Why this priority**: Makes ongoing benefit utilization visible and supports
the annual maximum tracking bonus requirement.

**Independent Test**: Load a fictional profile and verify the allowance,
usage, and remaining balance; exercise the chosen usage-update mechanism.

**Acceptance Scenarios**:

1. **Given** seeded existing usage, **When** the dashboard opens, **Then**
   allowance, used benefits, and remaining benefits are displayed.
2. **Given** an uncompleted estimate, **When** the employee explores options,
   **Then** their recorded benefit usage stays unchanged.
3. **Given** a recorded change in completed usage, **When** the dashboard and
   conversation next display benefits, **Then** both use the updated values.

---

### Edge Cases

- Unknown procedure or plan-change inquiry: explain supported scope and guide back.
- Missing employee or company: ask for a valid selection before estimating.
- Zero remaining allowance: show zero insurer contribution without a negative balance.
- Unknown or malformed fixture relationships: report the issue rather than guess.
- Missing price or coverage: request supported input or explain unavailable data.
- Negative prices, invalid dates, and invalid coverage values: reject clearly.
- Profile change: reset conversation and comparison context so results do not leak
  between fictional employees.
- External conversation service failure: display a recoverable message and preserve
  the dashboard; an explicitly identified local demonstration mode may be available.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST represent different fictional companies, exactly
  one plan per company, and employees belonging to those companies.
- **FR-002**: The system MUST apply each selected employee's company plan and
  individual existing usage to every estimate and comparison.
- **FR-003**: Employees MUST see annual allowance, used benefits, and remaining
  benefits on a dashboard alongside a guided conversation.
- **FR-004**: The conversation MUST guide procedure input, gather missing
  supported information, explain the result, and offer relevant next choices.
- **FR-005**: Estimates MUST show procedure price, insurer payment, employee
  share, applicable coverage, and any annual allowance limitation.
- **FR-006**: Estimates and comparisons MUST NOT change recorded benefit usage.
- **FR-007**: The system MUST compare supported treatment dates on either side
  of the plan's annual reset and state the continuing-plan and price assumptions.
- **FR-008**: The system MUST compare network options when fictional data
  supports both; otherwise it MUST clearly identify unavailable information.
- **FR-009**: Explanations MUST originate from supplied plan facts and calculated
  results. The dashboard and conversation MUST agree.
- **FR-010**: Unsupported or ambiguous requests MUST receive clarification or
  supported choices, including a redirect for plan-changing questions.
- **FR-011**: The system MUST accept a checked, common representation of
  incoming fictional company, employee, and procedure data.
- **FR-012**: The system MUST visibly identify fictional data and approximate
  estimates and MUST NOT claim real claims adjudication or clinical advice.
- **FR-013**: Completed-care usage updates MUST follow
  [NEEDS CLARIFICATION: should employees manually record completed care in the
  demo, or should the first version only display supplied usage?]
- **FR-014**: Treatment scheduling scope MUST be
  [NEEDS CLARIFICATION: compare one procedure across dates, or support a short
  sequence of multiple already needed procedures across the plan-year reset?]
- **FR-015**: The interface MUST provide loading and recoverable error states,
  keyboard-operable controls, and a usable dashboard on desktop and phone widths.

### Key Entities

- **Company**: Stable identity, display name, and exactly one plan.
- **Plan**: Annual allowance, benefit reset, coverage values, and explanatory text.
- **Employee**: Stable identity, display name, company, and individual usage.
- **Procedure**: Supported identity, name, category, and fictional cost inputs.
- **Estimate**: Employee and procedure context, date/network choice, costs,
  insurer/employee shares, and explanation; separate from completed usage.
- **Usage**: Recorded insurer contribution for an employee's benefit year.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A demonstrator can complete a supported coverage journey within
  two minutes from selecting an employee.
- **SC-002**: At least two fictional companies have visibly different plan
  values; comparison scenarios demonstrate the different resulting coverage.
- **SC-003**: Every supported estimate reconciles procedure cost with insurer
  and employee shares, and neither usage nor remaining benefits becomes negative.
- **SC-004**: The timing comparison displays both alternatives and their
  assumptions for a fictional employee with partial usage.
- **SC-005**: All defined acceptance scenarios produce consistent dashboard
  and conversation results; exploring estimates leaves usage unchanged.
- **SC-006**: Unsupported questions and unavailable data offer a next step in
  every defined negative scenario.

## Assumptions

- This is an 18-hour hackathon demo using only fictional identities and plans.
- A demo employee selector provides context; production sign-in is outside scope.
- Annual usage measures insurer payments, not the employee's total dental spend.
- Coverage uses a deliberately small set of supplied percentages and allowance
  limits. Additional insurance rules are not required for the initial demonstration.
- A future-year comparison assumes unchanged plan and prices and refreshed
  allowance; the assumptions are shown rather than implied.
- The supplied JSON format is pending. Representative placeholder fixtures may
  be used for development and replaced after reviewing incoming data.
- Actual conversation-service setup requires the team's selected edition,
  cloud access, and credentials. External dependencies must be reported honestly.
- Real provider search, enrollment, arbitrary insurance document extraction,
  live claims processing, and clinical treatment decisions are outside scope.
- End-of-year reminders are secondary and do not block the core demo.
