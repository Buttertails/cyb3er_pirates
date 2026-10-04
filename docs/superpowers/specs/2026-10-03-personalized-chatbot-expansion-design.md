# Personalized dental chatbot expansion

Status: Proposed for written-design approval. Source: user requests more steps,
more rounded conversation, personalized input, alternative procedure costs,
and useful care scheduling across policy resets. The user selected the package
with interactive what-if cards and a benefits timeline.

## Goal

Help an already insured employee explore a planned treatment under their current
company's plan. Keep the existing deterministic Dialogflow approach, Python
Flask backend, Firebase login, current company policies and recorded usage.
One treatment case is active at a time; it may contain curated treatment stages.

## Agent structure

Expand the existing agent with reusable navigation routes and clearly named
pages rather than a single linear chain. Preserve current procedure/network
entities and page IDs where compatible. A free-form generative playbook is an
alternative, but conflicts with the chosen guided approach and shared-calculator
requirement. A single long chain would make follow-up questions restart intake.

Proposed steps and branches:

1. Welcome and menu: understand coverage, estimate treatment, explore options,
   compare timing, or review benefits already used.
2. Employee context: load the selected demo employee's company, plan and usage;
   confirm context and show the annual allowance/reset. Do not ask for known data.
3. Procedure identification: accept supported natural phrasing, clarify ambiguity,
   and confirm the planned treatment.
4. Priorities: optional budget, preferred timeframe and any dentist-provided
   deadline; skip this when the user only wants a quick estimate.
5. Network: in-network, out-of-network, or unsure. Unsure leads to explanation
   or comparing both, never an assumed network.
6. Coverage explanation: covered, partially covered, or excluded; explain the
   applicable category, deductible, remaining allowance and known restrictions.
7. Cost breakdown: plan payment, employee cost, projected remaining benefits,
   and the assumptions behind the calculation.
8. Alternative options: show curated comparable treatments, their plan coverage,
   employee costs and budget fit. Help the employee identify options to discuss
   with the dentist; do not declare clinical suitability.
9. Treatment stages: if the dataset marks this case as stageable, confirm the
   available stages and any permitted timing window.
10. Reset comparison: compare permitted schedules now/after reset/across reset,
    using actual modeled claim dates, annual usage and applicable limits.
11. Option review: summarize cost differences and which user preference each
    option meets; let the employee choose what to explore further.
12. Follow-up actions: change procedure/network/date/budget, ask why, review usage,
    return to menu, or confirm starting a new case.

Global routes handle help, benefits terminology, unclear input, unsupported
procedures, insurance-change questions, and returning to the previous question.
A benefits question during intake answers briefly and resumes the saved step.
Plan-change requests point to employer/HR and return to current-plan help.

## Data and financial logic

Use curated dummy procedure-option and treatment-stage data, aligned with the
team's procedure schema and existing catalog IDs. Each option names its cost,
coverage category and any applicability assumptions; each stage names its
procedure, ordering, separate cost and allowed timing window. Unknown option
relationships do not generate an invented substitute.

The shared backend calculates all costs using the employee's actual demo plan
and recorded usage. An alternative in an excluded category can still be cheaper,
but the agent must not imply it becomes covered. Comparison results include both
coverage and out-of-pocket differences, including cases with no modeled savings.

Reset comparisons apply only to limits that reset in the supplied policy. Known
lifetime orthodontic limits do not reset annually. Installments alone do not
create additional coverage: cross-year suggestions require a stageable treatment
and separately modeled services/claim dates. The agent does not suggest delaying
past a dentist-provided deadline. Missing rules are shown as assumptions or
unsupported comparisons, rather than fabricated savings.

## Backend and frontend integration

Reuse existing engine/compare/sequencing services, with thin authenticated
Dialogflow webhook handlers for benefits, estimate, alternatives and timing.
Extend the shared financial model only where required by the approved policy
rules; keep current calculator results compatible. Normalize procedure_id,
network and date values between existing agent forms and backend contracts.

Connect the real agent to the existing deployed Flask service. Configure the
necessary signed-session and webhook values outside Git/browser code, retain
webhook authorization, and never accept session-supplied financial overrides.
Keep login identity separate from the selected fictional demo employee context;
do not silently bind a real account to an arbitrary employee or company.

Provide a thin website chat interface using the real backend contract, with
messages, useful choice buttons and structured result cards. Coordinate with
team frontend changes; do not rewrite the existing intake/dashboard or send its
incompatible intake.* messages as if they were supported chat events.

## Selected standout features

Interactive what-if cards accompany the chatbot estimate. The employee can
change network, date or curated treatment option and compare each scenario
against the original estimate: employee cost, plan payment and projected
remaining allowance. Use the same backend calculation and saved conversation
context; cards must not contain a separate browser approximation. Budget changes
filter or label options without changing policy coverage. Unsupported scenarios
explain the missing rule. Changes do not record completed care.

A benefits timeline combines recorded care, the policy reset and projected
stages for the active treatment. Label recorded and projected entries distinctly.
Show usage and remaining allowance by policy year, update projections when a
what-if choice changes, and explain when a lifetime limit prevents extra savings.
The timeline is planning guidance, not a booking or claim submission system.

Reuse and extend the team's new dashboard/profile and completed-care screens.
Those currently keep additional profile details and procedure history in browser
storage, and estimates/intake use local_demo mode. Before enabling personalized
live comparisons, bind company/plan and authoritative usage to the verified
employee context. Do not treat the dashboard's sample appointments or hardcoded
plan as actual usage. Coordinate the required contract with the team; preserve
existing profile/login behavior and make demo context explicit.

Success: an employee can complete one supported conversation, change a scenario
without repeating intake, see costs and the timeline update consistently, and
return to the original estimate. Include both a useful reset comparison and a
no-savings example. Defer PDF export, employer editing and appointment booking.

## Delivery and verification

Deliver in increments: navigation and richer intake; live backend fulfillment;
alternative comparisons; staged/reset comparisons; what-if cards and timeline;
website integration and
complete journeys. Back up the remote agent before each change, keep a small
reviewable batch, and preserve rollback. Use controlled fictional conversations
for live verification; no account creation or usage writes are required.

Verify different companies/usage, partial and excluded orthodontic coverage,
curated alternatives, no-savings cases, annually resetting versus lifetime
limits, stage ordering/deadlines, interrupted questions, changed choices, restart,
unsupported requests and all existing backend/login behavior. A fake-service
test proves backend behavior; only an actual connected conversation proves the
live agent. Keep recorded usage separate from projected treatment payments.

## Boundaries

No enrollment optimizer, employer editing interface, clinical diagnosis,
automatically generated treatment substitutes, arbitrary split billing, claims
submission or automatic benefit-usage writes. Persistent completed-care reporting
requires a separate confirmed action and verified employee identity mapping.
Use existing cloud/Firebase resources; any additional resource or permission
requirement must be surfaced before changing it.

## Reference context

Lincoln's dental overview describes lifetime orthodontic limits:
https://www.lincolnfinancial.com/pbl-static/pdf/GP-IP---what-we-offer---callout5---flier-PDF.pdf
ADA describes braces and removable aligners under professional supervision:
https://www.mouthhealthy.org/all-topics-a-z/braces

After written-design approval, Spec Kit owns the specification, plan and tasks,
and the Superpowers bridge owns implementation. No implementation starts under
this proposed design before that approval.
