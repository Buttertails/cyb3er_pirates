# Implementation Plan: Standalone Flask cloud deployment

**Branch**: feat/flask-cloud-deployment | **Date**: 2026-10-03
**Spec**: spec.md | **Source**: approved Flask deployment design.

## Summary

Package the existing standalone Flask app with the team's Waitress dependency.
Deploy Cloud Run service dental-api and publish the existing Hosting frontend
with a /api/** rewrite to it. Preserve the Cloud Functions-managed api service.

## Technical Context

Python 3.12; Flask 3.0.3; Waitress 3.0.0; existing pinned backend requirements.
Cloud Run, Firebase Hosting, existing gcf-artifacts Docker repository and
existing gcf-v2-sources-124558628070-us-central1 bucket. Project cyb3r-pirates,
region us-central1, existing runtime/build account
124558628070-compute@developer.gserviceaccount.com. pytest and Node verification.
No new data storage. Hackathon demo: request billing, min instances 0, max 2,
1 CPU, 512 MiB, concurrency 4, timeout 60 seconds, port 8080.

## Constitution Check

Pass before/after design: shared calculator, fictional seed data, one company
plan, existing login, no usage writes, no credentials in browser/image,
proportional deployment scope, explicit verification limits. No violations.

## Research and Structure

Official Hosting documentation supports Cloud Run /api/** rewrites in
us-central1. Existing api is Cloud Functions-managed, so deploy dental-api
separately. Use the existing repository and bucket for build inputs/logs;
missing permissions require investigation, not unrelated provisioning.

Root Dockerfile preserves /app/backend, /app/Data and /app/frontend. Workdir
/app/backend; Waitress listens on 0.0.0.0:$PORT. Root .dockerignore and
.gcloudignore allow only production source, preventing credentials, tests,
local environments and Git metadata from upload. The production command uses
existing main:app and no Cloud Functions shim. firebase.json adds one run
rewrite; no Functions or Firestore deployment is invoked.

## Delivery Sequence

T001 creates production startup and upload exclusions with verification of a
real Waitress process in a clean copied production layout. T002 wires Hosting.
T003 runs all application/config tests, commits the source, builds into existing
gcf-artifacts, deploys dental-api with existing account and approved limits,
and verifies direct routes before releasing Hosting. T004 publishes only
Hosting and verifies site/proxy paths, records evidence, requests review,
merges into main, completes bridge and assesses convergence.

## Boundaries

No API, schema, auth provider, database, agent, billing setting, cleanup policy,
or app feature changes. Existing frontend intake/chat contract gaps and missing
Dialogflow environment configuration remain outside deployment. Chat 503 is
reported as incomplete setup, never as a working conversation. Retain old
function for rollback. Do not push Git unless separately requested.
