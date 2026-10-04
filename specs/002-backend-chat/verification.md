# Backend verification

Date: 2026-10-03. Branch: feat/backend-chat. Base: f51ab49.

## Original implementation evidence

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

## Compatibility after pulling Firebase login

Pulled origin/main through 7cd7057 into the shared checkout, then merged that
main revision into feat/backend-chat without Git conflicts. The prior local
Firebase alias edit was preserved in a named stash; upstream's corrected
cyb3r-pirates project ID is retained.

The combined suite first exposed a real runtime incompatibility: the team's
adapter now keys policies by C0/I1/C2, while the chat fixtures used integer IDs.
Updated only chat fixture references, validation and contract expectations to
use those canonical prefixed IDs. Existing company/employee data and calculator
rules remain unchanged.

The ignored frontend/js/firebaseConfig.json file is absent in this checkout.
Added a loader that preserves a supplied file and, on 404 only, reads Firebase
Hosting's reserved /__/firebase/init.json config. Other file errors remain visible.
It does not create apps, enable providers, change projects or create accounts.

Fresh verification:

- Main before chat integration: 77 backend tests passed.
- Combined branch: **166 backend tests passed** with fake external services.
- `node frontend/tests/firebase-config.test.mjs`: **4 tests passed** with fake fetch.
- Firebase module syntax and `git diff --check`: passed.
- An integration test verifies Firebase-authenticated /me and demo /chat coexist,
  anonymous /me still returns 401, and a Firebase ID token cannot authorize the
  Dialogflow webhook. Demo chat is not bound to real logged-in account data.

Actual Firebase sign-in and live Dialogflow calls were not exercised. No cloud
resources, auth providers, databases, billing or deployed files changed.
Compatibility fixes are on feat/backend-chat; main contains the pulled team code.
