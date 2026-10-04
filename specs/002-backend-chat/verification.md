# Backend verification

Date: 2026-10-03. Branch: feat/backend-chat. Base: f51ab49.

## Evidence

Baseline: 66 backend tests passed. Each new task first failed because its
production module/route did not exist, then passed with implementation.
Final command from backend/:

`/tmp/cyb3er-deploy-venv/bin/python -m pytest`

Result: **151 passed**, including the original 66. `git diff --check` passed.

- Real Flask webhook and shared engine produce filling payments of $160/$40
  for Pat, capped $100/$100 for Sam, and root-canal payment $500/$500 for Lee
  under Company C. Company A does not cover the adult root-canal category.
- Fake external agent drives start → filling → network → estimate and changed
  network ($174/$116 out of network), reusing the real webhook/calculator.
- Tampering, expiry, mismatched employee/session, missing authorization,
  malformed requests and external/webhook failures are rejected.
- SDK tests use real protobuf request/response types with the external client
  replaced. Regional endpoint, deadline, retry suppression and context binding
  are asserted without resolving ADC or contacting Google.
- Estimates preserve the fixture bytes and recorded balances. Only valid
  calculated financial results reach the chat response. Final fulfillment
  replaces earlier financial messages and estimates.
- Scoped diff confirms no changes to frontend, Data, auth.py, store.py,
  firebase.json or .firebaserc on this branch.

## Review

A separate read-only reviewer was requested through the review skill, but it
could not run because of a usage limit. No independent-review approval is claimed.
Manual review covered configuration, signed references, dataset validation,
webhook protocol, SDK conversion, request validation and financial response flow.
Two defects found during review were reproduced with failing tests and fixed:
stale financial text after a later webhook reprompt, and unverified balance
summary prose. Both regression tests pass in the final suite.

## Convergence

Assessed all eight requirements, four acceptance scenarios, four success criteria
and six tasks against current code. No remaining in-scope gaps. The bridge
reported task-file hash drift because task checkboxes changed to complete; task
descriptions were preserved. Warning and event history are retained.

## Delivery and limits

Code is preserved on the isolated local branch. Not pushed, merged or deployed.
No agent configuration, cloud resources, billing settings, authentication or
Firestore were changed. Mocked Dialogflow calls do not verify a live connection.

Later live setup needs the configured project/region/agent, server ADC permissions,
signing key and webhook authorization token, deployment and HTTPS webhook/tag
attachment. These are separate authorized steps. The frontend does not yet call
the new chat endpoint. Fixture usage is simplified fictional seed data; actual
profiles, reporting and usage persistence remain outside this feature.
