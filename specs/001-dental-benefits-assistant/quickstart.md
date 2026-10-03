# Quickstart and Validation Guide

**Status**: Future run guide. Application code, fixtures, agent configuration,
and tests have not been created. These commands become runnable after the
canonical tasks are implemented.

## Prerequisites

Python 3.12+, a modern browser, Firebase CLI/Firestore emulator prerequisites, and fictional JSON mapped to
[contracts/data.md](contracts/data.md). For live chat, supply a Google Cloud
project with Dialogflow enabled, credentials, a configured CX agent, and a
reachable authenticated HTTPS webhook. The local demonstration mode does not
require Cloud access.

## Planned Local Setup

From the repository root:

```sh
python3 -m venv .venv
.venv/bin/python -m pip install -r requirements.txt
cp .env.example .env
.venv/bin/python -m pytest backend/tests
.venv/bin/python -m uvicorn backend.app:app --reload
```

The planned config loads .env with python-dotenv. Before starting the API,
start the Firestore emulator in another terminal using the future firebase.json:

```sh
firebase emulators:start --only firestore --project demo-dental
```

Set FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 and the same project ID in .env.
Seed fictional profiles with the future `python -m backend.seed` command.
Expected local URL: http://127.0.0.1:8000.

Use explicitly configured local_demo mode until live CX is ready. Company plans
remain in JSON; employee profiles, baseline usage and confirmed reports live in
Firestore. Emulator export/import retains data across emulator shutdowns.
Fix the reference date to the fixture demonstration period for reproducibility.

## Validation Scenarios

1. Select a fictional employee, choose a crown, and read coverage/cost shares.
   Price must equal insurer plus employee shares; usage must remain unchanged.
2. Select an employee at another company and estimate the same procedure.
   Coverage must use that company's plan.
3. Select an employee with different usage in the same company.
   Remaining benefits and allowance-limited estimates must differ as expected.
4. Compare the same procedure now versus the next reset and compare available
   networks. Both assumptions and missing network information must be visible.
5. Respond yes to recent procedures, enter insurer-paid amount, preview, and
   confirm. Benefits must refresh, and repeating the same submission must not
   double count it. Skip must leave usage unchanged.
6. Restart the backend. Confirmed reports must remain, with baseline counted
   once. Test emulator export/import separately if the emulator also restarts.
7. Change employee during a chat request. Prior responses must not appear under
   the new employee. Ask about changing plans and verify the scope redirect.
8. Use keyboard controls and a phone-width viewport; check readable results,
   loading states and retry after an unavailable conversation service.

## Live Dialogflow Validation

Follow the future `docs/firebase-setup.md` for live Firestore credentials/IAM,
and `docs/dialogflow-setup.md` for live CX. Switch to dialogflow mode, verify
CX pages actually execute and call the authenticated webhook, and compare the
structured results with the direct estimate endpoint. Confirm error handlers
and record evidence in `docs/verification.md`.

Do not report live chat verified from local_demo or mocked tests. Deploying or
publishing is separate from this planning-only request.

## Incoming Data

Review collaborator JSON against the data contract, record the mapping, and
validate before replacement. Keep compatible fixture identities or explicitly
reset the fixture set. An employer editing page is not required for this version.
