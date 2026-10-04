# Deployment research

Decision: Standalone Cloud Run dental-api, with Firebase Hosting rewrite.
Rationale: existing api has goog-managed-by=cloudfunctions; preserve that runtime
while giving the team's server an independent production target.
Alternative: modifying the managed runtime would mix owners; serving the entire
site directly from Run would change the existing Hosting arrangement.

Decision: Waitress on 0.0.0.0:$PORT and existing pinned requirements.
Rationale: follows the team's production server choice; packages Data beside
backend so the existing policy loader works unchanged.

Preflight confirms Cloud Run, Cloud Build, Artifact Registry and Firebase Hosting
APIs are enabled, gcf-artifacts exists as DOCKER, and the existing source bucket
is in US-CENTRAL1. No new API/repository/bucket is required by this plan.

References:
https://firebase.google.com/docs/hosting/cloud-run
https://docs.cloud.google.com/run/docs/quickstarts/build-and-deploy/deploy-python-service
