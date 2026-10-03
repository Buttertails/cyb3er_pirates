# Demo Requirements Checklist: Dental Benefits Assistant

**Purpose**: Review requirement quality for the simplified hackathon demo.
**Created**: 2026-10-03
**Feature**: [spec.md](../spec.md)
**Depth / Audience**: Lightweight author and teammate review before implementation.

**Review Ownership**: Reviewer-owned requirements-quality artifact. Mark `[x]`
only when a reviewer determines that the written criterion is satisfied.
**Marker Semantics**: Checked means requirements reviewed, not code implemented.

## Completeness and Scope

- [ ] CHK001 Is exactly one plan per company stated consistently? [Completeness, Spec §FR-001]
- [ ] CHK002 Is employee-specific usage distinguished from company policy? [Clarity, Spec §FR-002, §FR-016]
- [ ] CHK003 Is the first version limited to one procedure at a time? [Consistency, Spec §FR-014]
- [ ] CHK004 Are employer editing, sequencing and reminders explicitly deferred? [Completeness, Spec §Assumptions]

## Data and Calculation Clarity

- [ ] CHK005 Are allowance, usage, and money units defined without ambiguity? [Clarity, Plan §Technical Context, Data Model]
- [ ] CHK006 Are missing prices and coverage distinguished from zero coverage? [Clarity, Spec §FR-008, Data Model]
- [ ] CHK007 Are annual reset boundaries and continuing-plan assumptions defined? [Clarity, Spec §FR-007, Data Model §Benefit Period]
- [ ] CHK008 Are incoming JSON mapping and invalid-reference handling specified? [Completeness, Spec §FR-011, Contracts §Data]
- [ ] CHK009 Does the report contract identify insurer-paid amounts and confirmation? [Clarity, Spec §FR-013, Contracts §POST /api/usage]
- [ ] CHK010 Are duplicate submissions, baseline counting, and restart retention specified? [Coverage, Data Model §Completed-Care Report]

## Conversation and Dashboard Consistency

- [ ] CHK011 Do chat and dashboard obtain financial results from the same logic? [Consistency, Spec §FR-009, Plan §Architecture]
- [ ] CHK012 Is unsupported-question recovery defined, including changing plans? [Coverage, Spec §FR-010, Contracts §Conversation]
- [ ] CHK013 Is employee-switch behavior defined for pending chat results? [Coverage, Spec §Edge Cases, Data Model §Conversation Context]
- [ ] CHK014 Are loading, failure, keyboard and phone-width requirements included? [Completeness, Spec §FR-015]

## Dependencies and Acceptance

- [ ] CHK015 Are cloud IDs, credentials and reachable webhook setup documented as external inputs? [Dependencies, Plan §External Setup Inputs]
- [ ] CHK016 Is local-demo verification distinguished from live Dialogflow verification? [Clarity, Research §Cloud Setup, Quickstart §Live Dialogflow Validation]
- [ ] CHK017 Are complete journey and different-company outcomes measurable? [Measurability, Spec §SC-001, §SC-002]
- [ ] CHK018 Are estimates distinguished from confirmed recorded usage throughout? [Consistency, Spec §FR-006, Contracts §API]
- [ ] CHK019 Is the database-only scope distinguished from sign-in requirements? [Clarity, Spec §Assumptions, Contracts §Firebase]
- [ ] CHK020 Are Firestore baseline import, transaction retries and emulator retention requirements documented? [Coverage, Spec §FR-017, Contracts §Firebase]

## Notes

Generated 20 items, all unchecked for reviewer evaluation. This is separate from
the built-in requirements.md checklist, maintained by specify/clarify (16/16
passing). Implementation completion belongs only in canonical tasks.md.
