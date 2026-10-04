# Dental Benefits Assistant Constitution

## Core Principles

### I. Demo Scope and Simplicity

The application MUST help an already insured employee understand a planned
procedure under their current company plan. It MUST prioritize an end-to-end
hackathon demonstration within an 18-hour development budget. Fictional prices,
plans, employees, and simplified coverage rules are acceptable and MUST be
identified as demonstration data. Enrollment and real claims processing are
outside the initial scope.

### II. Shared Benefit Logic

Coverage estimates, remaining benefits, and comparisons MUST originate from
one shared backend model. Chat and dashboard MUST use those results. Financial
values MUST NOT be invented by the conversation service. Estimated future care
MUST be distinguishable from recorded benefits usage.

### III. Company and Employee Context

Each company MUST have exactly one plan, and every employee MUST reference a
company. Different companies MAY have different coverage values. Usage MUST
belong to the employee, not to a company-wide shared allowance. Incoming JSON
MUST be checked for valid relationships and values before it is used.

### IV. Guided, Understandable Interaction

The assistant MUST guide employees through supported questions and explain
coverage and options in plain language. Unsupported questions and missing
information MUST result in clarification or supported choices. The dashboard
MUST keep current benefits and comparison results visible. Provider and timing
comparisons MUST state the assumptions used.

### V. Evidence Before Completion

Changes to benefit logic and integration behavior MUST follow TDD through the
bridge. Verification MUST cover company differences, employee usage, estimates,
and conversation/dashboard consistency. Completion claims MUST identify fresh
verification evidence and any unconfigured external dependencies.

## Project Constraints

- Python backend, JavaScript frontend, guided Dialogflow conversation.
- One application and shared backend serve all fictional companies.
- Credentials MUST stay outside version control and the browser.
- Local development MUST have a documented path using fictional inputs.
- Framework and hosting choices MUST remain proportional to the demo.
- Live claims, insurer enrollment, clinical diagnosis, and exhaustive insurance
  rules MUST NOT be added without an approved scope amendment.

## Development Workflow

The approved design is
`docs/superpowers/specs/2026-10-03-dental-benefits-assistant-design.md`.
Spec Kit owns the feature specification, plan, checklists, analysis, and tasks.
The Superpowers bridge owns implementation execution. Canonical task completion
MUST be recorded only in the feature's `tasks.md`. Handoff state, hooks, guards,
and bridge events MUST be preserved. Implementation MUST be followed by a
convergence assessment against the canonical artifacts.

The tools MUST remain independently upgradeable. Upgrades MUST NOT happen
automatically, and changes to Spec Kit or Superpowers MUST be checked against
the bridge's verified versions before proceeding.

## Governance

This constitution governs implementation with the approved design and canonical
Spec Kit artifacts. Material scope changes or conflicting requirements MUST be
returned to Spec Kit for clarification before affected implementation proceeds.
Amendments MUST document their rationale, update dependent feature artifacts,
and use semantic versioning: major for incompatible principles, minor for new
principles, and patch for clarifications. Reviews MUST check compliance and
justify additional complexity against the hackathon budget.

**Version**: 1.0.0 | **Ratified**: 2026-10-03 | **Last Amended**: 2026-10-03
