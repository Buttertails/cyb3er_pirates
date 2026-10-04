# Standalone Flask cloud deployment

Status: Proposed for user review. Source: explicit request to update cloud to
match the team's standalone Flask direction after pulling origin/main 4a3a427.

## Goal

Deploy the current standalone Flask app in project `cyb3r-pirates`. Keep the
existing Firebase Hosting address and forward `/api/**` to that app. Preserve
team Firebase Authentication, databases, data files, and application behavior.

## Selected approach and alternatives

Use a standalone Cloud Run service `dental-api` in `us-central1`, running the
team's pinned Waitress server against `main:app`. Keep Firebase Hosting for
static frontend files and add a Cloud Run rewrite for `/api/**`.

The existing `api` runtime is labeled `goog-managed-by=cloudfunctions` and has
a function entrypoint. Reusing it directly would mix deployment owners. A
separate Flask service gives a clear deployment target and preserves rollback.
Hosting the frontend inside Flask is possible, but would change the existing
Hosting address/configuration arrangement unnecessarily for this request.

## Deployment changes

- Add a repository-root container definition and source exclusions. Package
  `backend/`, `Data/`, and the current frontend with their existing relative
  paths; keep credentials, local environments, tests, and Git metadata out.
- Start Waitress from the backend directory, bound to `0.0.0.0` and the runtime
  `PORT`. Keep Flask routes under `/api`; no Cloud Functions adapter.
- Build into the existing `gcf-artifacts` container repository using the
  existing build infrastructure and runtime service account. Inspect resource
  availability first; surface required permission changes rather than silently
  provisioning unrelated infrastructure.
- Deploy only `dental-api`, with request-based billing, zero minimum instances,
  a maximum of two instances, 1 CPU, 512 MiB memory, and a 60-second timeout.
  Allow public HTTPS invocation so Hosting can reach it. Firebase ID token
  checks continue to protect the existing signed-in application routes.
- Set the runtime Google project to `cyb3r-pirates`. Do not copy local user
  credentials into the image or create service-account keys.
- Add the Hosting `/api/**` rewrite to `dental-api`, then publish Hosting after
  the new service passes direct checks. Deploy only Hosting, without deploying
  Firestore rules or modifying Auth providers.
- Keep the existing Cloud Function untouched for rollback. Record the new
  service URL, deployed source revision, and verification evidence.

## Scope and constraints

This updates hosting and production startup only. It does not change procedure
or plan schemas, calculators, login flows, database content, frontend message
contracts, or Dialogflow configuration. Chat currently requires separate server
keys and webhook setup; missing configuration must remain an explicit 503.
No successful live chat or account sign-in is claimed by deployment checks.
The user's deployment cost authorization applies to this project and deployment;
no billing settings, quotas, cleanup policies, or unrelated resources change.

## Success and verification

Run the existing backend and frontend configuration tests. Verify the
production server serves health, catalog, the current C0/C2 plans, and a dummy
estimate. Verify anonymous `/api/me` remains 401. Verify the Hosting address
serves the current frontend and forwards these requests to the new Flask
service. Check Firebase init configuration still identifies `cyb3r-pirates`.
Confirm chat routes are reachable and honestly report missing configuration.
On a failed new-service check, leave Hosting pointing at the previous backend.

## Planning ownership

After this written design is approved, Spec Kit owns the deployment spec,
plan, and canonical tasks; the existing Superpowers bridge owns execution.

## Reference documentation

- https://firebase.google.com/docs/hosting/cloud-run
- https://docs.cloud.google.com/run/docs/quickstarts/build-and-deploy/deploy-python-service
