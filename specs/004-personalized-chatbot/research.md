# Research and decisions

## Reuse rather than replace

Decision: deterministic CX pages plus shared Flask engine. Local evidence:
chat_routes.py already signs employee sessions, dispatches benefits.summary and
benefits.estimate, and verifies financial payloads; dialogflow_client.py uses
regional CX SessionsClient. Generative playbooks and an independent frontend
calculator were considered and rejected by the approved design.

## Session/forms/events

Decision: normalize procedure_id and legacy procedure, use explicit allowlisted
CX events and parameters, null invalidated values on change. Snapshot currently
uses procedure_id while backend expects procedure. Reusable return_to page state
supports interruptions without wiping the current case.
Official sources:
- https://docs.cloud.google.com/dialogflow/cx/docs/concept/parameter
- https://docs.cloud.google.com/dialogflow/cx/docs/reference/rest/v3/SessionInfo
- https://docs.cloud.google.com/dialogflow/cx/docs/concept/handler
- https://docs.cloud.google.com/dialogflow/cx/docs/reference/rest/v3/Fulfillment

## Lifetime and stage gaps

Decision: explicit fictional rules and dated shared-engine projections. Engine
estimate currently caps only annual benefits; models declares lifetime ortho
maximum but estimate does not use it. mock_plans.to_employer_plan derives that
field from the annual allowance, so it cannot serve as an explicit policy rule.
Do not invent lifetime limits for actual team policies. New curated fixture can
supply a clearly labeled fictional lifetime example. Unknown rules prevent the
unsupported comparison. Existing sequence_care is not safe to reuse unchanged
for separately priced ordered stages and accumulated lifetime usage.

## UI and identity

Decision: additive chat page/link, explicit fictional employee selection separate
from authenticated UID. Team api.js currently local_demo; extra profile history
is browser-stored and profile shows hardcoded DEMO_PLAN/sample appointments.
Automatically importing that history or inferring plan from it would yield
inconsistent identity/benefit results. Preserve it and use authoritative fixtures
for this feature; a persistence migration remains separate work.

## Cloud and secrets

Decision: reuse current dental-api, Hosting and CX agent. Existing ChatConfig
requires project/location/agent and two private tokens; currently unset in cloud.
Store values outside Git/browser, configure only the existing service/agent.
No new cloud service/API/database is presumed necessary. No installed version
upgrades are required. Remote read/changes follow backup and small-batch checks.
