# Research: Dental Benefits Assistant

Date: 2026-10-03. Planning only; no application code, dependencies, agent,
cloud resources, or deployment have been created.

## Backend and frontend

**Decision:** FastAPI with Pydantic request/response models, Python 3.12 or newer,
vanilla HTML/CSS/JavaScript modules, and a single backend serving the website.

**Rationale:** A small JSON API and webhook benefit from explicit validation and
documented responses. One dashboard and guided chat do not need a frontend build
pipeline. Same-origin static hosting keeps setup small.

**Alternatives:** Flask is suitable if the team later identifies stronger Flask
experience. React adds setup without an existing starter. Those changes must be
reflected in the canonical plan before implementation.

Sources: [FastAPI features](https://fastapi.tiangolo.com/features/),
[FastAPI testing](https://fastapi.tiangolo.com/tutorial/testing/),
[Flask](https://flask.palletsprojects.com/en/stable/),
[React setup](https://react.dev/learn/build-a-react-app-from-scratch).

## Firebase user data and completed usage

**Decision:** Following the user's Firebase choice, use Cloud Firestore for
employee profiles, benefit-period baseline/reported totals, and confirmed
procedure submissions. Python uses the Firebase Admin SDK; the browser calls
Python endpoints. JSON remains the source for company policies, procedure prices,
and initial profile/baseline seed inputs.

**Rationale:** The selected database stores user data across backend restarts.
Use the fixture-set namespace and idempotent seeding so reports are not reset
or mixed with unrelated replacement data. The employee supplies and confirms
the insurer-paid amount; a total bill or uncompleted estimate is not usage.

**Alternatives:** SQLite and writable JSON were considered earlier. Firestore
is now the planned user store. The user confirmed profiles and usage storage
only; Firebase Authentication is excluded. Use the demo profile selector.

Source: [Firebase Admin setup](https://firebase.google.com/docs/admin/setup).

**Transaction decision:** Read the existing submission and benefit-period
totals before writes. A matching retry returns the existing report; conflicting
reuse fails. Otherwise validate the remaining allowance, create the submission,
and update period totals atomically. Transaction retries must not trigger chat
calls or other external side effects.

Source: [Firestore transactions](https://firebase.google.com/docs/firestore/manage-data/transactions).

**Access decision:** Keep Firestore access on Python. Server SDKs use IAM and
bypass browser Security Rules; direct browser database access is denied. Python
applies the approved demo identity model rather than relying on those rules
to authorize its API.

Source: [Firestore access model](https://firebase.google.com/docs/firestore/security/get-started).

**Development decision:** Use the Firestore emulator with a matching demo project
ID and FIRESTORE_EMULATOR_HOST without a URL scheme. Export/import is required
to retain emulator data across emulator shutdowns. Emulator checks do not prove
production IAM. Firebase CLI and Java prerequisites are setup inputs checked
during future implementation.

Source: [Firestore emulator](https://firebase.google.com/docs/emulator-suite/connect_firestore).

## Money and validation

**Decision:** Use integer cents for all amounts. Use decimal coverage fractions
between zero and one, rounding insurer payment to cents with ROUND_HALF_UP before
applying the remaining allowance. Employee share is price minus insurer payment.
Check cross-record references and duplicate IDs after field validation.

**Rationale:** Explicit rounding makes displayed shares reconcile. Missing
coverage or network prices remain unavailable, not implicitly zero. Reject
negative amounts, boolean monetary values, invalid dates, and broken references.

Sources: [Python Decimal](https://docs.python.org/3/library/decimal.html),
[Pydantic strict mode](https://docs.pydantic.dev/latest/concepts/strict_mode/).

## Guided conversation

**Decision:** Dialogflow CX v3 deterministic flows. Custom frontend calls Python
`/api/chat`; Python calls CX detectIntent; CX calls a standard Python webhook.
The webhook uses the shared calculator and returns text plus a structured payload.
Python extracts `queryResult.webhookPayloads` and normalizes it for the dashboard.

**Rationale:** Flow pages support guided collection. Structured results avoid
parsing financial values from chat text. Bind a server-created session UUID to
the selected employee; the webhook resolves authoritative plan and usage from
that binding rather than trusting conversational values.

**Alternatives:** Messenger reduces chat UI work but needs dashboard adaptation.
Flexible webhooks are possible; standard webhooks provide a fixed request format.
Generative playbooks are unnecessary for the approved controlled conversation.

Sources: [CX API interaction](https://docs.cloud.google.com/dialogflow/cx/docs/quick/api),
[WebhookResponse](https://docs.cloud.google.com/dialogflow/cx/docs/reference/rest/v3/WebhookResponse),
[QueryParameters](https://docs.cloud.google.com/dialogflow/cx/docs/reference/rest/v3/QueryParameters),
[Sessions](https://docs.cloud.google.com/dialogflow/cx/docs/concept/session).

## Cloud setup and failure behavior

**Decision:** Recommend a regional CX agent in `us-central1`, default language
`en`, and timezone `America/New_York`. Keep Google credentials on the backend.
Use Application Default Credentials locally and runtime credentials when hosted.
The generic webhook requires reachable HTTPS and a configured authorization
header. Hosting/provider selection remains a setup dependency, not a deployment
authorization.

Retain a five-second webhook timeout and use a 15-second detectIntent deadline
with an 18-second frontend deadline. Configure no-match/no-input and webhook
failure handlers. Preserve the last dashboard on errors and offer retry; never
silently claim a local flow is Dialogflow.

An explicitly labeled local guided demo mode may support development without
cloud configuration; it must use the same shared calculations. It does not
satisfy live CX verification, which remains a separate implementation check.

Sources: [CX setup](https://docs.cloud.google.com/dialogflow/cx/docs/quick/setup),
[Access control](https://docs.cloud.google.com/dialogflow/cx/docs/concept/access-control),
[Webhooks](https://docs.cloud.google.com/dialogflow/cx/docs/concept/webhook),
[Webhook resource](https://docs.cloud.google.com/dialogflow/cx/docs/reference/rest/v3/projects.locations.agents.webhooks),
[State handlers](https://docs.cloud.google.com/dialogflow/cx/docs/concept/handler).

## Resolved scope and dependencies

The user chose one procedure at a time. Multi-procedure sequencing, employer
editing, and expiration reminders are deferred stretch goals. Initial employer
policy changes replace validated JSON and restart the demo.

Incoming JSON content, the actual Cloud project/agent identifiers, credentials,
and a reachable webhook URL are external setup inputs. They do not require
inventing requirements. Implementation tasks must include fixture mapping,
cloud setup instructions, and accurate reporting of unavailable integrations.

Plan an agent blueprint and future verified agent export. Google recommends
treating exported JSON as generated backup data; do not invent a working export
during this planning-only stage.
Source: [CX JSON export](https://docs.cloud.google.com/dialogflow/cx/docs/reference/json-export).
