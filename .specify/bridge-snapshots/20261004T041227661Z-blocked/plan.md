# Implementation Plan: Cloud profile and completed care

**Branch**: `feat/cloud-profile-persistence` | **Date**: 2026-10-03 | **Spec**: [spec.md](spec.md)

## Summary

Persist authenticated profile fields and confirmed completed care in the existing Firestore database. Bind chat sessions to the verified Firebase UID, combine confirmed insurer payments with fictional seed usage through the shared benefits calculator, and connect existing frontend screens without a false local success path.

## Technical Context

**Language/Version**: Python 3.11 compatible Flask backend; browser JavaScript
**Primary Dependencies**: Flask 3, Firebase Admin SDK, Firestore client, Dialogflow CX client
**Storage**: Existing Firestore `users/{uid}` and account/fictional-employee subcollections
**Testing**: pytest and Node frontend tests; authenticated cloud smoke test
**Target Platform**: Existing Cloud Run service and Firebase Hosting site
**Project Type**: Flask API plus static JavaScript frontend
**Performance Goals**: One report and refreshed chat benefits in a few seconds for a hackathon demo
**Constraints**: Preserve existing records/resources, no credential file or IAM change, no fake success when cloud fails
**Scale/Scope**: Existing fictional plans, three demo employees, single procedure at a time

## Constitution Check

- Demo data and simplified coverage remain labeled fictional: pass.
- Shared backend engine computes remaining balance; chat does not invent amounts: pass.
- One plan per company, employee-specific usage, validated JSON: pass.
- Guided chat and existing dashboard remain available: pass.
- TDD and verification for financial and integration behavior: required in tasks.
- No new real claims, enrollment, diagnosis, or credential exposure: pass.

Rechecked after data model and contracts: no constitution exception.

## Project Structure

```text
backend/
  main.py                 # authenticated profile and procedure routes
  store.py                # Firestore merge and account-scoped records
  chat_context.py         # UID-bound signed session
  chat_routes.py          # recorded usage in live responses/webhook
  tests/                  # route, isolation, ledger, chat tests
frontend/
  js/api.js               # authenticated profile/procedure clients
  js/estimate.js          # connected result without fake fallback
  js/procedures.js        # explicit fictional employee selection
  procedures.html
  tests/
specs/005-cloud-profile-persistence/
  spec.md plan.md research.md data-model.md quickstart.md contracts/ tasks.md
```

**Structure Decision**: Extend the existing Flask and static frontend layout and deployment path. Add small modules where validation or repository logic would otherwise obscure routes.
