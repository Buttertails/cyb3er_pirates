# Tasks: Dentist lookup in conversation

**Input**: [spec.md](spec.md), [plan.md](plan.md), [contract](contracts/dentist-chat.md)

## Phase 1: Shared contract

- [ ] T001 [US1] Write failing tests for the signed CX webhook directory payload and chat response in `backend/tests/test_chat_routes.py`, including session UID, result shape, and ordinary estimate turns.
- [ ] T002 [US1] Extract the existing signed profile directory lookup from `backend/main.py` into `backend/dental/dentists.py`; use it from both `GET /api/me/dentists` and the `dentists.find` webhook in `backend/chat_routes.py`, preserving the existing status and sample-office shape.
- [ ] T003 [US1] Pass the `dentist_directory` webhook payload through `POST /api/chat` in `backend/chat_routes.py` as `dentists`, with `null` on other turns and no user-supplied company or ZIP.

## Phase 2: Conversation interface

- [ ] T004 [US1] Write a failing frontend behavior test for a live chat dentist response in `frontend/src/pages/LiveBenefitsChat.jsx`, then render the existing `DentistResults` card from `result.dentists` and remove the standalone dentist button and direct button lookup path.
- [ ] T005 [US1] Add a `dentists.find` intent, flow-wide route, and visible Dentists page to the existing Dialogflow CX agent in `cyb3r-pirates/us-east1`; connect its entry fulfillment to the `dentists.find` webhook tag and provide a way back to procedure questions. Preserve all existing routes.

## Phase 3: Validation and delivery

- [ ] T006 Run backend pytest, frontend tests/build, and focused CX phrases from opening, procedure, network, and estimate stages; verify follow-up procedure questions and record evidence in `specs/007-dentist-chat-branch/verification.md`.
- [ ] T007 Merge the feature into `main`, push, and update the existing Cloud Run API and Firebase Hosting release; confirm the deployed chat contract and agent branch without changing Auth or Firestore.
