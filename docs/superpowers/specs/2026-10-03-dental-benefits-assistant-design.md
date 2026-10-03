# Dental benefits assistant: hackathon design

Date: 2026-10-03
Status: Draft for user approval

## Purpose and success

Help an already insured employee understand how their current dental plan
applies to a procedure they need, see an approximate employee cost, and compare
timing or provider options that could make better use of their benefits.

The project has an 18-hour hackathon development budget. Success is a working,
understandable demonstration of this journey, with visibly different answers
for employees whose companies have different plans or whose benefits usage
differs. Insurance accuracy is intentionally simplified.

## Confirmed decisions

- Use fictional company plans and employee data.
- Each company has exactly one plan. Different companies have different plans.
- Employees already have insurance; this experience does not select plans during
  enrollment or recommend changing plans.
- Include existing employee usage and a way to track benefits utilization.
- Use a guided conversation with Dialogflow, which the team has experience with.
- Use a Python backend and JavaScript frontend as the working technology choices.
- Present the guided chat alongside a dashboard.
- Collaborators are gathering JSON data; its exact contents are pending.

## Product experience

The employee starts in the context of a fictional employee profile. The
dashboard shows their company, current plan, annual benefit allowance, used
benefits, and remaining benefits.

The assistant guides the employee through describing an already needed
procedure, gathering information required for an estimate, and understanding
the result in plain language. Results appear in the conversation and dashboard.
The employee can explore relevant treatment dates or provider options.

Questions about changing plans receive a brief explanation of the supported
scope and a path back to the current procedure. An unrecognized request should
prompt clarification or show supported choices rather than invent an answer.

## Architecture and responsibilities

One application serves every company through a shared conversation flow and
shared backend logic. Company differences are represented by plan data.

| Component | Responsibility |
| --- | --- |
| JavaScript frontend | Dashboard, chat presentation, employee context, estimates and comparisons |
| Dialogflow | Recognize supported requests, extract information, guide follow-up questions |
| Python backend | Read the applicable plan and employee usage; calculate estimates and comparisons; supply controlled explanations; support usage tracking |
| JSON data | Fictional companies and plans, employees and existing usage, and procedure cost inputs |

The frontend and conversation obtain benefit results from the same Python
logic. Dialogflow is not the source of company plan facts or financial
calculations. No additional generative LLM is proposed for the first version.

The exact Dialogflow edition, frontend framework, backend framework, and
connection mechanism are implementation choices to resolve through Spec Kit.
The current backend, frontend, and chat directories contain placeholders.

## Simplified benefit model

Each employee has their own usage against their company's annual benefit
allowance. Proposed modeling assumption: usage represents insurer payments,
and remaining allowance is annual allowance minus benefits used.

Procedure costs and plan coverage rules produce approximate insurer and
employee shares. The model should be small enough to explain and demonstrate;
it does not need to reproduce real claims adjudication.

A comparison across the annual reset assumes the fictional plan and procedure
prices continue unless supplied data explicitly defines a change. Timing
comparisons concern financial implications for an already needed procedure.

An estimate must not silently become recorded benefits usage. The mechanism for
recording completed care and retaining updated usage remains a product decision.

## Scope boundaries

The core demonstration includes guided procedure input, a coverage explanation,
an approximate cost breakdown, a timing comparison, and benefits usage visibility.
It must show that the selected company's plan affects the result.

Provider or network comparisons depend on supplied fictional prices and plan
rules. Real provider search, live claims integration, arbitrary plan document
ingestion, clinical treatment selection, enrollment, and full insurance rule
accuracy are outside this first version. Expiration reminders are a secondary
feature rather than a prerequisite for the main journey.

## Pending inputs and decisions

- Review the incoming JSON for company plans, employee usage, and procedure
  prices; agree a common representation rather than a separate format per company.
- Confirm which Dialogflow edition the team already knows and can access.
- Choose how the demo identifies an employee and records completed usage.
- Decide whether the first timing comparison covers one procedure or a short
  sequence, consistent with the challenge's care-sequencing requirement.
- Confirm available network data and the demo's hosting environment.

These items are explicit open questions. Material answers must be incorporated
in the canonical specification before implementing the affected behavior.

## Risks and verification

The primary risks are spending the time budget on integration, mismatched data
formats, and inconsistent results between chat and dashboard. Keep one shared
backend and a small set of supported conversations.

Verify an end-to-end guided journey; different company plans produce different
results; employee usage affects remaining benefits; unsupported questions are
handled predictably; and estimates do not change recorded usage. Check the
chosen timing comparison with representative fictional inputs.

## Workflow handoff

The repository is prepared by sdd-init. After explicit approval of this design,
carry this document and approved conversational decisions into Spec Kit. Its
constitution is currently a template and needs meaningful project principles.
Spec Kit owns the specification, plan, checklists, tasks, and analysis.
Implementation then uses the installed Superpowers bridge and canonical tasks,
followed by convergence assessment. This document is a design, not a separate
implementation plan.
