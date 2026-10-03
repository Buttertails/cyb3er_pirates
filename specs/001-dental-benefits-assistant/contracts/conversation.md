# Guided Conversation Contract

Use Dialogflow CX v3 deterministic flows. No generative playbooks are required.
One agent serves all companies through server-bound employee context.

## Pages and Transitions

| State | Employee experience | Next state |
| --- | --- | --- |
| Welcome | See current company/plan context and supported purpose | Procedure |
| Procedure | Describe or select one needed procedure | Network |
| Network | Choose in-network or out-of-network; missing choices are prompted | Estimate |
| Estimate | Read backend-produced coverage and employee cost | Options |
| Options | Compare dates, compare networks, or estimate another procedure | Compare or Procedure |
| Compare | Read structured single-procedure alternatives and assumptions | Options |
| Restart | Clear prior choices and start a fresh employee-bound session | Welcome |

The dashboard separately prompts “Have you had any recent procedures?”
Choosing yes opens the completed-care report form with procedure, date and amount
insurance paid. Show a preview and confirmation before the explicit usage write.
Choosing skip changes no usage. After a saved report, refresh benefits and any
current estimate; the next chat result reads the refreshed usage.

## Inputs

Procedure entities match supported IDs, names and aliases from fixture data.
Network values are in_network and out_of_network.
Treatment date defaults to the configured reference date; the timing comparison
uses the next benefit-period start. Explicit dates are validated in Python.

Python controls employee_id and fixture_set_id through a session binding. They
are not editable chat parameters. Amounts and plan percentages are not extracted
as authoritative facts from free text.

## Fulfillment

- Welcome/context: `benefits.summary`.
- Estimate: `benefits.estimate`.
- Timing/network alternatives: `benefits.compare`.

See [api.md](api.md) for standard webhook fields and structured payloads.
Static flow responses may describe scope or ask questions; all financial
answers use the backend.

## Unsupported and Failure Paths

No-match/no-input: repeat the current question with supported choices.
Unknown procedure: ask for a supported procedure rather than choose one silently.
Plan-changing questions: explain that the assistant helps with existing coverage
and offer to resume the current procedure.
Missing network price/coverage: show unavailable and offer an available option.
Webhook error/timeout: explain that the estimate could not be refreshed, offer
retry, and preserve the prior dashboard.
Profile change: cancel/discard stale frontend responses and create a new session.

## Agent Setup and Validation Deliverables

Future implementation creates `chat/flow-blueprint.json` and
`docs/dialogflow-setup.md` describing pages, entity values, intents, parameters,
routes, tags, error handlers and webhook configuration. Configure through the CX
console/API, test the live agent, then preserve a verified export under
`chat/agent-export/`. Never label a hand-written blueprint as a live agent export.

Cloud configuration needs project ID, region, agent ID, language, credentials and
HTTPS webhook authentication. Use a 5-second webhook timeout, 15-second Python
detectIntent deadline, and 18-second frontend timeout. Configure retryable error
messages and no-match handlers.

An explicit local_demo configuration may simulate this same flow for development
without cloud credentials. Its UI and verification record must identify it as
local demo; only a successful live-agent journey verifies Dialogflow.
