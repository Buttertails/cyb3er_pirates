# Cloud profile and completed-care persistence

**Status:** Proposed for user approval, 2026-10-03.

## Verified problem

The Flask backend is running on Cloud Run `dental-api`; Firebase Hosting's
`/api/health` rewrite returns 200. The current Cloud Run revision has received
successful `PUT /api/me/location` requests, which write `users/{uid}` through
Firestore. The deployed old intake frontend still has `API_CONFIG.mode =
'local_demo'` and `profileDetailsLive = false`. Its name, company, office,
completed procedures and last-sign-in marker are therefore stored in browser
storage. Flask has only `GET /api/me` and `PUT /api/me/location` for signed-in
profile data. Simply changing either flag would call missing routes or send
unsupported `intake.*` events to `/api/chat`.

The separate `/chat.html` page calls the live backend and Dialogflow, but uses
read-only fictional employee usage from `backend/fixtures/demo.json`. It cannot
see a user's newly recorded care. Current chat sessions are not bound to the
Firebase UID, so adding per-user usage requires fixing that boundary first.

## Goal and success

An authenticated user's name, company, office, sign-in marker and confirmed
completed care persist in Firestore across browsers and backend restarts. A
confirmed report with an insurer-paid amount changes the remaining allowance
shown in a new or continuing live chatbot conversation for the same selected
fictional employee. Estimates and unconfirmed entries never change usage.

## Exact design

1. Keep Firebase Authentication in the browser and verify its ID token in
   Flask. `GET /api/me` returns the signed-in user's stored profile fields.
   `PATCH /api/me` accepts only validated name, company and office fields;
   `POST /api/me/sign-in` saves the update marker. Firestore writes use merge
   semantics so a later location save does not erase other profile fields.
2. Keep the existing fictional employee selector for the multi-company demo.
   The completed-care screen explicitly selects that same demo employee before
   submission. `GET /api/me/procedures?employee_id=...` and `POST
   /api/me/procedures` read and write only under the verified account's
   `users/{uid}/demo_employees/{employee_id}/procedures/{submission_id}` path.
   The backend validates the employee against the fixture set and derives its
   company and plan there. Browser-supplied UID, company, plan and calculated
   balance are rejected. Records for different UIDs or demo employees never
   mix.
3. A report contains one procedure from the existing completed-care form,
   service month, and optional cost, employee-paid and insurer-paid amounts.
   The backend validates IDs against that form's checkup/general list, then
   converts dollars to nonnegative integer cents and validates dates and
   totals. For this demo's January 1 plan year, a month-only report uses the
   first of that month as its ledger date. Its insurer-paid contribution cannot
   put that employee above the modeled annual allowance. A missing
   insurer-paid amount saves the history entry but contributes zero to known
   allowance usage, labeled as unknown payment. The browser sends a stable
   submission ID so retrying the same report cannot double count; reusing an
   ID with different contents is rejected. An empty report list writes no
   usage.
4. The chat route requires a Firebase ID token and signs the verified UID
   together with the selected demo employee and fixture-set ID into its
   server-side session context. Old unsigned/UID-free chat sessions receive
   an explicit restart response. The webhook uses that signed context to load
   the matching user's confirmed Firestore reports, combines them with the
   fictional seed usage for that employee, and passes the combined usage into
   the existing shared calculator. It does not trust user-supplied financial
   or identity fields. The `/api/chat` response and verified webhook estimate
   use the same combined usage so their balances agree.
5. Once the endpoints are live, switch the existing profile and update pages
   to those routes. Show clear save errors instead of silently falling back
   to browser storage. The results page uses the existing cloud estimate API
   and reports errors rather than generating a local fake estimate. The old
   intake wizard's unsupported step events remain client-side selections and
   are labeled as such; the live chat remains a separate connected flow.
   Existing browser-only procedure records are not auto-imported because they
   have no verified demo-employee assignment and could be counted twice.

## Delivery and verification

Use the existing Firestore database, Cloud Run service, Firebase Hosting site,
and service identity. Do not create a database, change IAM/rules/Auth settings,
use a downloaded service-account key, or alter the team's unrelated records.
Implement in small TDD increments: profile routes and merge writes; confirmed
procedure records and idempotency; UID-bound chat usage; frontend connection;
then deploy only Flask and Hosting. A Dialogflow flow edit is unnecessary for
this data-path fix.

Tests must prove profile fields survive location updates and reload, two user
accounts and two demo employees stay isolated, invalid/duplicate reports do
not add usage, unknown insurer payments are labeled, annual allowance changes
only after confirmation, and chat/webhook amounts agree for two companies.
After deployment, verify the current service revision and Hosting assets, then
complete an authenticated report and chat journey with a test account. Preserve
the existing account data and record the tested revision and rollback path.

## Boundaries

This remains a fictional benefits demo. Reporting care is not a real claim,
clinical validation, enrollment change, or employer policy edit. A user's
saved company label does not silently override the explicitly selected demo
employee's plan. No existing local history is deleted; it simply stays local
until a separate, user-confirmed migration is designed.
