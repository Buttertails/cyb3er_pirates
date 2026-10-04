# Tasks: Navigation, Chat Follow-ups, and Procedure PDF Intake

**Input**: `specs/008-navigation-chat-pdf/spec.md`, `plan.md`, `research.md`, `data-model.md`, and `contracts/document-chat.md`.

## Phase 1: Setup

- [x] T001 Pin pypdf 6.19.0 in backend/requirements.txt and record the dependency decision in specs/008-navigation-chat-pdf/research.md.

## Phase 2: Foundational

- [x] T002 Add focused red-green tests for signed-in document upload authorization and chat-session continuity in backend/tests/test_chat_routes.py and frontend/src/pages/LiveBenefitsChat.test.jsx.

## Phase 3: User Story 1 — Assistant and Account navigation (P1)

- [x] T003 [US1] Add Assistant and Account navigation with active-page indication and phone-width access in frontend/src/components.jsx and frontend/css/styles.css; redirect authenticated users away from sign-in and clear stale local account display data in frontend/src/pages/AccountPages.jsx and frontend/src/lib/auth.js; verify with frontend/src/components.test.jsx and frontend/src/pages/AccountPages.test.jsx.
- [x] T004 [US1] Preserve the current live session and messages across Assistant/Account route changes in frontend/src/App.jsx and frontend/src/pages/LiveBenefitsChat.jsx; clear on sign-out/account change and verify with frontend/src/pages/LiveBenefitsChat.test.jsx.

## Phase 4: User Story 2 — Procedure PDF intake (P1)

- [ ] T005 [US2] Implement in-memory PDF validation, at-most-5-MB and at-most-20-page limits, bounded page streams, text extraction, and catalog candidate matching in backend/pdf_intake.py with red-green cases in backend/tests/test_pdf_intake.py.
- [ ] T006 [US2] Implement authenticated multipart POST /api/chat/document using the existing employee/session verifier and standard response shape in backend/chat_routes.py, with red-green contract tests in backend/tests/test_chat_routes.py.
- [ ] T007 [US2] Add a document-uploaded CX event and confirmation/clarification routes through tools/dialogflow/ and backend/dialogflow_client.py; verify one, many, and zero candidate paths in tools/dialogflow/tests/ and backend/tests/test_chat_routes.py.
- [ ] T008 [US2] Add the PDF picker, immediate upload and chat handoff, document preview, and retryable errors in frontend/src/pages/LiveBenefitsChat.jsx and frontend/src/lib/api.js; verify in frontend/src/pages/LiveBenefitsChat.test.jsx and frontend/src/lib/api.test.js.

## Phase 5: User Story 3 — Follow-up conversation (P2)

- [ ] T009 [US3] Expand CX training and routes for benefits, estimate follow-ups, changing network/procedure, dentist finding, plan-reset guidance, and clarification in tools/dialogflow/; verify representative turns in tools/dialogflow/tests/.
- [ ] T010 [US3] Keep all financial statements grounded in backend calculator results while handling added follow-up routes in backend/chat_routes.py and backend/dialogflow_client.py; verify with backend/tests/test_chat_routes.py.
- [ ] T011 [US3] Present context-appropriate follow-up choices without forcing a restart in frontend/src/pages/LiveBenefitsChat.jsx; verify in frontend/src/pages/LiveBenefitsChat.test.jsx.

## Phase 6: Polish and delivery

- [ ] T012 Run focused backend/frontend checks and a frontend build; confirm recent visits are unchanged; record evidence and any cloud status in specs/008-navigation-chat-pdf/verification.md.

## Dependencies and independent checks

- T001–T002 precede implementation. T003–T004 complete US1; T005–T008 complete US2; T009–T011 complete US3; T012 follows all stories.
- US1: Assistant → Account → Assistant retains messages and active session; direct sign-in URL redirects an authenticated user or clears stale local display data.
- US2: One upload of a text PDF reaches a procedure confirmation; invalid/scanned files leave chat usable.
- US3: Estimate → change network → benefits → dentists works in one session with backend-derived figures.
- MVP is US1 + US2; US3 extends the same conversation afterward.
