# Implementation Plan: Nearby in-network dentists

**Branch**: `main` | **Date**: 2026-10-04 | **Spec**: [spec.md](spec.md)

**Input**: Approved design
`docs/superpowers/specs/2026-10-04-nearby-dentists-design.md` and this feature spec.

## Summary

Add a small curated provider directory to the existing Flask backend. An
authenticated request reads the caller's saved ZIP and company, resolves the
company's single fictional plan, filters matching sample offices, ranks them
by straight-line distance, and returns a short list. The signed-in React chat
renders the results as cards with sample rating, phone and map link. The
existing onboarding office choices use the same directory data for supported
ZIPs, replacing fabricated addresses and fixed distances.

## Technical Context

**Language/Version**: Existing Python 3 compatible Flask backend; React and JavaScript frontend
**Primary Dependencies**: Flask, Firebase Admin/Firestore already installed, React, Vite
**Storage**: Existing Firestore profile fields; versioned JSON fixture for fictional offices and supported ZIP centers
**Testing**: pytest for pure ranking and authenticated route; Vitest for React/client states; production build; manual authenticated smoke check
**Target Platform**: Existing Cloud Run API and Firebase Hosting React site
**Project Type**: Web application with same-origin JSON API
**Performance Goals**: At most five sorted results visible within three seconds for seeded test accounts
**Constraints**: No new Firestore collection, credential, paid map/provider/geocoding service, or browser geolocation
**Scale/Scope**: Current test-account ZIP areas, including North Carolina where present; small fictional office list

## Constitution Check

- Demo scope: fictional offices and sample ratings, phones and network status
  are identified as sample data; no real provider claim. Pass.
- Shared benefit logic: directory does not calculate coverage or alter recorded
  usage; any future cost comparison continues to use the backend engine. Pass.
- Company context: company maps to exactly one plan; server uses the verified
  account's saved company and ZIP. Pass.
- Guided interaction: chat provides the entry point and clear empty/error
  states. Distance is labeled approximate. Pass.
- Evidence: tests cover plan filtering, account isolation, distance order,
  frontend results and error states; manual smoke uses current test accounts.
  Pass.
- No live claims, enrollment, clinical advice, new paid service, or credential
  changes. Pass.

Rechecked after data model and contract design: no constitution exception.

## Project Structure

### Documentation

```text
specs/006-nearby-dentists/
  spec.md
  plan.md
  research.md
  data-model.md
  contracts/nearby-dentists.md
  quickstart.md
  tasks.md
  checklists/requirements.md
```

### Source Code

```text
backend/
  fixtures/dentists.json      # sample office and ZIP-center coordinates
  dental/dentists.py           # fixture validation, plan filtering, distance ranking
  main.py                      # authenticated nearby-dentists route
  tests/test_dentists.py       # ranking and fixture tests
  tests/test_user_routes.py    # route authentication and profile-context tests
frontend/
  src/lib/api.js               # authenticated directory request
  src/pages/LiveBenefitsChat.jsx # chat action and result state
  src/components.jsx           # dentist result card
  src/lib/chatScript.js        # onboarding office picker uses directory results
  css/styles.css               # card layout and narrow-screen styles
  src/lib/api.test.js          # request and failure contract tests
  src/components.test.jsx      # rendered result and empty-state tests
  src/lib/chatScript.test.js   # onboarding consistency tests
```

**Structure Decision**: Extend the existing Flask and React structure. A
small pure backend module owns fixture validation and ranking so both the
authenticated chat list and onboarding data come from one source.
