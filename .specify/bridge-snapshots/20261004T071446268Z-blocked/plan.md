# Implementation Plan: Dentist lookup in conversation

**Branch**: `007-dentist-chat-branch` | **Date**: 2026-10-04 | **Spec**: [spec.md](spec.md)

## Summary

Extend the live Dialogflow CX agent with a dentist lookup intent and page reachable from the active conversation. Its webhook uses the signed session context to call the existing fictional directory logic. The chat API passes a structured result to React, which renders the existing dentist card in the conversation. Remove the separate lookup button.

## Technical Context

- **Language/Version**: Python 3, JavaScript/React 19
- **Dependencies**: Flask, Dialogflow CX, Firebase Admin, Vite
- **Storage**: Existing Firestore user profile and static `dentists.json`
- **Testing**: pytest; Vitest; production frontend build; CX test phrases
- **Target**: Existing Cloud Run API, Firebase Hosting, Dialogflow CX agent in `cyb3r-pirates/us-east1`
- **Scope**: One new conversational branch, no new account data or provider service

## Constitution Check

- Demo scope: pass; reuse fictional offices, no external provider directory.
- Shared benefit logic: pass; no estimates or financial values generated here.
- Account context: pass; use signed session UID and saved profile only.
- Guided interaction: pass; lookup intent available from conversation stages and follow-up can return to benefits questions.
- Evidence: backend contract tests, frontend tests/build, and focused CX probe before completion.

## Project Structure

```text
specs/007-dentist-chat-branch/
  spec.md plan.md research.md data-model.md contracts/ quickstart.md tasks.md
backend/
  dental/dentists.py      # shared lookup helper
  main.py                 # existing signed directory endpoint
  chat_routes.py          # webhook and chat payload
  tests/                  # contract tests
frontend/src/
  pages/LiveBenefitsChat.jsx
  lib/api.js
```

**Structure Decision**: Extend the existing Flask, React, and Dialogflow services; no new service or database collection.
