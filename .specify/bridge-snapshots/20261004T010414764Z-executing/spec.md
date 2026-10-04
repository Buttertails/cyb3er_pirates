# Feature Specification: Standalone server cloud deployment

**Feature Branch**: `feat/flask-cloud-deployment`
**Created**: 2026-10-03
**Status**: Approved deployment scope
**Input**: Update cloud to match the team's standalone server direction.
**Source**: docs/superpowers/specs/2026-10-03-flask-cloud-deployment-design.md

## User Scenarios & Testing

### User Story 1 - Use the current application online (Priority: P1)

As a teammate, I can use the latest server and frontend at the existing website
address without running a local server.

**Why this priority**: The cloud must match the team's current implementation.
**Independent Test**: Load the website, read current procedures and plans, and
request an estimate using dummy inputs.

**Acceptance Scenarios**:

1. Given the current source, when deployed, the website serves that frontend
   and its backend requests reach the current standalone server.
2. Given dummy company policy C0 and a filling, requesting an estimate returns
   the existing shared calculator's result.
3. Given an anonymous request to a protected profile, access remains rejected.
4. Given a build or service verification failure, the existing site stays
   connected to the previously working deployment.

### Edge Cases

- Missing conversation configuration returns the existing explicit error;
  deployment does not claim a working live conversation.
- Private credentials or local environments must not enter an upload/image.
- Missing build permissions are surfaced; unrelated resources are not created.
- A restarted server retains the existing stateless chat context behavior.

## Requirements

### Functional Requirements

- **FR-001**: Deploy the team's current standalone server and current frontend.
- **FR-002**: Preserve the existing website address and backend route paths.
- **FR-003**: Include current policy and fixture data with unchanged relationships.
- **FR-004**: Preserve authentication checks, calculator results, and data stores.
- **FR-005**: Keep private credentials and local tools out of deployable artifacts.
- **FR-006**: Limit deployment scope and running capacity to the approved demo.
- **FR-007**: Verify the new server before switching the site, retain rollback.
- **FR-008**: Report live verification and any unconfigured integration honestly.

## Success Criteria

### Measurable Outcomes

- **SC-001**: The existing website successfully serves current UI, procedure and
  policy lists, and a dummy estimate in all delivery checks.
- **SC-002**: Anonymous profile access is rejected in both automated and live checks.
- **SC-003**: No login providers, database content, or group resources are changed.
- **SC-004**: Application tests pass and deployment artifacts contain no credentials.

## Assumptions and Clarifications

The user explicitly approved updating cloud deployment in cyb3r-pirates to
match the pulled standalone Flask server, using the written deployment design.
Existing Firebase services and prior function remain preserved. Cloud deployment
costs for this project are authorized. No framework change, schema work, new
conversation contract, live Dialogflow setup, or actual account sign-in testing
is part of this deployment task. No unresolved material product choices remain.
