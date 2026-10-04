# Flask cloud deployment verification

Source commit: 823e6ff. Reviewed scope: Dockerfile, source exclusions,
Hosting rewrite and the necessary Firestore dependency correction.

Baseline: 165 backend tests. A clean production requirements install initially
failed because upstream Firestore 2.16.1 excludes protobuf 6 required by CX 2.7.0.
Pinned Firestore 2.34.0, already installed in the passing baseline/previous image.
Clean environment installs successfully; dependency check and all 165 tests pass.
Frontend Firebase config tests: 4 passed.

The real Waitress probe first failed because the production startup file was
missing. After container configuration, actual Waitress in a copied production
layout passes health, catalog, C0/C2 plans, filling estimate, anonymous /me 401,
and missing-chat-configuration 503. Source upload allowlist verifies 51 files,
no credentials/local tools/tests, and necessary Data and fixture files included.

Independent read-only reviewer reported no critical, important or minor findings.

Cloud Build 7c1a643e-02b5-496a-b619-df0bb449f5a0: SUCCESS.
Image: us-central1-docker.pkg.dev/cyb3r-pirates/gcf-artifacts/dental-api:823e6ff
Digest: sha256:2af13e708982c739cfe924e4c3b3d01f60c65a85b1d40d27ac614a30149189d5
Cloud Run service dental-api, region us-central1, project cyb3r-pirates.
Revision dental-api-00001-r8j receives 100% of traffic. Existing compute service
account reused; min 0/max 2 instances, 1 CPU, 512 MiB, concurrency 4, 60s timeout.

Direct https://dental-api-nrl7quagra-uc.a.run.app checks passed: health, catalog,
C0/C2 plans, dummy estimate, anonymous profile rejection, reachable chat/webhook
with explicit 503 chat_not_configured, current Firebase configuration modules.
No account/database writes. Current app source and existing API paths preserved.

The initial Hosting release passed all checks; the newer source refresh below is the final delivered version.


## Upstream update during delivery

The user reported newer backend changes before final delivery. Main was already
updated through be6f3c1 (51504cf and 8a60abb), and was pulled again to confirm it
is current. Integrated those changes into the deployment branch: improved API
404/405 JSON handling and the team's local_demo setting for intake messages.
The prior Flask service and Hosting release passed all 12 live checks, but the
container and site are being refreshed again to match this newer source.


## Final source refresh

Application source commit 405a6de includes main be6f3c1 and the team's new backend
API error handling and local_demo intake setting. Both suites remain passing:
165 backend tests in the clean environment, 4 frontend config tests.

Second Cloud Build 4f1d14b1-2f4c-4e40-bf41-3be8dba8d4f3: SUCCESS.
Image dental-api:latest-team in existing gcf-artifacts repository.
Digest sha256:4d1ae72e1ff8e5a1a44279e7a9c199d23287df93409bf3f1f504942847ec2918.
Revision dental-api-00002-gsl serves 100% of traffic with the same approved limits.
Twelve direct checks pass, including an unknown API POST returning the team's
new JSON 404. Refreshed Hosting frontend is published at cyb3r-pirates.web.app.

Known integration boundary: actual Firebase account sign-in was not exercised;
no accounts or profile/usage writes were made. Dialogflow keys/webhook and
frontend intake/chat contract integration remain pending. Chat 503 is explicit
missing setup, not a successful live conversation. No Firestore/Auth/agent
settings, billing settings, API enablement, artifact cleanup policies or prior
function were changed. No Git push performed.


Final https://cyb3r-pirates.web.app verification: 13 checks passed. Current
frontend includes results/estimate scripts and the team-selected local_demo
intake setting; health, catalog, C0/C2 policies, dummy estimate, anonymous /me
401, explicit chat/webhook configuration errors, Firebase init project, and
new unknown-API JSON 404 all match the latest source. The Hosting rewrite points
to dental-api/us-central1, so the current website uses the standalone Flask server.
