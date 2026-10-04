# Implementation Plan: Navigation, Chat Follow-ups, and Procedure PDF Intake

**Branch**: `008-navigation-chat-pdf` | **Date**: 2026-10-04 | **Spec**: `specs/008-navigation-chat-pdf/spec.md`

**Input**: Approved `docs/superpowers/specs/2026-10-04-navigation-chat-pdf-design.md`.

## Summary

Preserve live chat while navigating between Assistant and Account; accept a text-based PDF in the chat, extract bounded context in Flask, and route it into the CX session for explicit procedure confirmation. Expand CX follow-up routes while keeping all benefit figures in the existing calculator.

## Technical Context

**Language/Version**: Existing Python 3 backend and JavaScript React 19 frontend  
**Primary Dependencies**: Flask 3, Dialogflow CX SDK, Firebase Authentication, pypdf 6.19.0, React Router  
**Storage**: Existing Firestore profile/usage only; active conversation and document preview in browser memory  
**Testing**: Focused pytest for PDF/chat contracts, Vitest for navigation and chat state, one frontend build  
**Target Platform**: Existing Firebase Hosting and Cloud Run service  
**Project Type**: Existing web application  
**Performance Goals**: One-page document reaches a chat question in one upload action  
**Constraints**: PDF at most 5 MB and 20 pages, bounded content stream per page, no PDF storage or OCR  
**Scale/Scope**: One signed-in user and active conversation per browser tab

## Constitution Check

- Demo scope: passes; no claims processing, enrollment, or clinical advice.
- Shared benefit logic: passes; CX and PDF text suggest a procedure, but backend calculates all figures.
- Company context: passes; signed-in plan remains authoritative.
- Guided interaction: passes; ambiguous documents and questions get supported choices.
- Evidence: TDD and focused integration checks through the bridge.
- Credentials: no keys or document contents committed or stored in Firestore.

Post-design check: no constitutional exception is needed.

## Project Structure

```text
specs/008-navigation-chat-pdf/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
└── tasks.md

backend/
├── main.py
├── pdf_intake.py
├── chat_routes.py
├── dialogflow_client.py
└── tests/
frontend/src/
├── components.jsx
├── App.jsx
├── pages/LiveBenefitsChat.jsx
└── lib/api.js
tools/dialogflow/
```

**Structure Decision**: Reuse current React, Flask, and CX layers. Introduce one PDF module for testable extraction. Keep temporary chat preview in React memory. The sign-in route checks restored Firebase authentication before deciding whether to redirect or clear stale browser profile data.

## Delivery

US1 navigation and chat preservation, then US2 document intake, then US3 CX follow-ups. Each is independently testable. After verification, deploy the backend to the existing Cloud Run service, update the existing CX agent, and release the React bundle through Firebase Hosting. Recent visits remain unchanged.
