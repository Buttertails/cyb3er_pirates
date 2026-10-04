# Personalized chatbot verification

## Baseline and current state

Worktree: feat/personalized-chatbot at /tmp/cyb3er-personalized-chatbot.
Baseline: 165 backend tests pass in the clean verification environment.
Read-only cloud inventory: existing dental-api in cyb3r-pirates, us-central1;
only GOOGLE_CLOUD_PROJECT is configured. Existing agent is in us-east1,
ea6d5b47-1426-4edd-b895-7d4f275f0a65. It contains Start, Procedure,
Network and Estimate, four intents including defaults, and zero webhooks.
Estimate has a static unavailable response, which explains the unchanged demo.

Sanitized full before snapshot: chat/agent-config/live-before-2026-10-03.json.
Restore: use the saved resource definitions for this exact agent and compare
against the live resource before any rollback; do not replace teammate changes
unreviewed. This paragraph records the state before the cloud changes below.

## Cloud test increment — 2026-10-03

- The existing `dental-api` Cloud Run service is on revision
  `dental-api-00003-txq`. Its Dialogflow settings and webhook token are runtime
  variables; no token value is stored here. The existing Dialogflow CX agent in
  `cyb3r-pirates` now has Menu and Benefits pages, a dynamic estimate webhook,
  and routes for direct procedure input, help, terms, and returning to the menu.
  The sanitized pre-change snapshots are in `chat/agent-config/`.
- Deployed 38 tracked frontend files to the existing Firebase Hosting site.
  `https://cyb3r-pirates.web.app/chat.html`, its two local JavaScript modules,
  `profile.html`, and the Hosting `/api/health` rewrite all returned HTTP 200.
  The page requires an existing Firebase sign-in and explicitly selects a
  fictional employee for each conversation. Existing intake/profile screens
  were preserved. A browser sign-in session has not yet been tested.
- Live HTTP conversations through **the Hosting `/api/chat` rewrite** returned
  HTTP 200 for both Demo Company A (Pat) and Demo Company C (Lee). Pat:
  `I need braces` → Network → `in network` → Estimate ($0.00 plan,
  $5,500.00 employee; orthodontics not covered) → `review my benefits` →
  Benefits ($7,250.00 recorded allowance remaining) → `main menu` → Menu.
  Lee: `help` → Menu guidance → `estimate a procedure` → Procedure →
  `filling` → Network → `out of network` → Estimate ($174.00 plan,
  $116.00 employee). The estimates did not change recorded usage.
- `node --test frontend/tests/chat.test.mjs frontend/tests/firebase-config.test.mjs`
  passed (2 test files); backend chat/profile tests passed in the existing
  verification environment. The live website chat UI is available for a
  signed-in teammate to try; browser sign-in and recovery flows remain to be
  verified before checking T011.
- Rollback path: inspect the current Hosting release and deploy the prior
  Hosting version if the chat page causes a site regression. For the agent,
  compare the sanitized before snapshots with the current agent before
  restoring any route; do not overwrite teammate changes. Cloud Run revision
  can be rolled back by moving traffic to the verified prior revision after
  inspecting it. Do not alter Firebase Auth or Firestore.

## Procedure language training increment — 2026-10-03

- Before snapshots: `chat/agent-config/live-before-training-2026-10-03.json`
  and `live-before-annotation-repair-2026-10-03.json`, both with webhook
  authorization redacted. `tools/dialogflow/training_batch.py` checked the
  live target fields against each snapshot and patched only the
  `procedure.direct` training phrases and `dental_procedure` synonyms.
- The direct-procedure intent grew from 6 to 18 phrases and the existing
  procedure entity gained 16 synonyms. Eight newly added phrases had their
  article moved outside the annotated procedure span in a second scoped patch;
  the live intent readback confirmed 18 phrases after correction. Existing
  intent and entity entries remained present.
- `python -m unittest discover -s tools/dialogflow/tests -p 'test_*.py'`
  passed (3 tests). Through deployed Hosting `/api/chat`, Pat's "My dentist
  says I need a filling" reached Network then a $160 plan / $40 employee
  estimate; Lee's "My dentist proposed a bridge" reached Network then a
  $680 plan / $1,020 employee estimate. In a separate live conversation,
  "metal braces" on the Procedure page advanced to Network. No usage writes
  were made.
- The bridge's T008 remains open: this increment covers procedure wording,
  while the remaining navigation, unsure branch, and complete scoped restore
  tooling still need implementation and verification. The new upload and
  provider-finder ideas are recorded in README planned features, outside the
  approved 004 delivery contract.

## Menu and network language training increment — 2026-10-03

- Fresh sanitized snapshot:
  `chat/agent-config/live-before-menu-training-2026-10-03.json`. The scoped
  patch added 10 phrases each to `benefits.review`, `estimate.start`, and
  `network.compare`, plus 6 aliases to `dentist_network`. Their live readbacks
  matched the proposed sets; no pages, fulfillment, policies or data changed.
- `python -m unittest discover -s tools/dialogflow/tests -p 'test_*.py'`
  passed (5 tests). In the first live test after the patch, "Show my benefits
  balance" reached Benefits, but "Can we price a procedure?" fell back to Menu.
  A later retry after the agent's automatic training interval reached
  Procedure, then "dental exam" → Network and "within my network" → a real
  Lee estimate ($120.00 plan / $0.00 employee). "Is it cheaper to stay in
  network?" reached Procedure, and "outside my network" produced Pat's
  out-of-network filling estimate ($174.00 plan / $116.00 employee).
- Treat an immediate no-match after an intent patch as a possible training
  delay and retry after training before changing routes. T008 remains open;
  new pages should accompany working backend behavior, not empty prompts.

## Network Unsure page increment — 2026-10-03

- Sanitized pre-change snapshots:
  `chat/agent-config/live-before-network-unsure-2026-10-03.json` and
  `live-before-network-copy-2026-10-03.json`. Added the `network.unsure`
  intent (10 phrases), a Network Unsure guidance page, and a route from the
  existing Network page. The new page explains how to check network status,
  then returns to the existing network form so the employee can choose a
  hypothetical network and change it later. Existing Network form and
  completion route were preserved.
- First live test reached the guidance page and the final Pat filling estimate,
  but asked the network question twice. A scoped copy-only patch removed the
  duplicate question. The final live website conversation was Start →
  Procedure → Network → uncertain-network guidance → Network → Estimate;
  its result was $160.00 plan / $40.00 employee and no recorded usage change.
  The final response contained one network question. The new page and route
  were verified by live configuration readback.
- `python -m unittest discover -s tools/dialogflow/tests -p 'test_*.py'`
  passed (8 tests) before the page update. T008 remains open for the other
  navigation paths, fuller no-match handling and restore tooling.

## Plan-change interruption increment — 2026-10-03

- Fresh scoped pre-change snapshot:
  `chat/agent-config/live-before-plan-change-2026-10-03.json`. Added
  `plan.change.question` with 12 training phrases and one flow-level route.
  The response explains that this demo contains one current employer plan,
  directs enrollment questions to HR, and lets the employee continue the
  active conversation. Live readback confirmed six routes, including all five
  routes in the snapshot. Firebase resources and the Flask service were not
  changed in this increment.
- The first Hosting `/api/chat` test immediately after applying the intent
  fell back to Menu. A retry after Dialogflow training reached the new answer.
  A second live conversation asked a plan-switch question at Menu and another
  while the Procedure page was active. The latter stayed on Procedure,
  repeated its question, then completed `filling` → `in network` → Estimate
  for Demo Company A (Pat): $160.00 plan / $40.00 employee. Recorded usage
  was not changed. `python -m unittest discover -s tools/dialogflow/tests
  -p 'test_*.py'` passed (10 tests).
- T008 remains open for broader navigation, fallback handling and restore
  tooling. Rollback is scoped to removing the added flow route and intent
  after comparing the live flow with the saved snapshot; do not replace
  unrelated changes or group resources.
