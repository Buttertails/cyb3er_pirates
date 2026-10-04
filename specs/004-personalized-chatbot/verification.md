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
