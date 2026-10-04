# Feature Specification: Navigation, Chat Follow-ups, and Procedure PDF Intake

**Feature Branch**: `008-navigation-chat-pdf`  
**Created**: 2026-10-04  
**Status**: Approved design carried into specification  
**Input**: `docs/superpowers/specs/2026-10-04-navigation-chat-pdf-design.md` and the user's instruction to keep recent visits unchanged.

## User Scenarios & Testing

### User Story 1 - Move between assistant and account (Priority: P1)

A signed-in employee can reach the assistant and account from the site header and knows which section is open. Moving between them preserves the current conversation.

**Why this priority**: Users need a reliable route back to the assistant before document intake adds another action.

**Independent Test**: Open assistant, exchange a message, navigate to account and back, and find the same conversation.

**Acceptance Scenarios**:

1. **Given** a signed-in user on the account page, **When** they choose Assistant, **Then** the assistant opens without restarting the session.
2. **Given** a signed-in user on the assistant, **When** they choose Account, **Then** account information appears and the header indicates Account is active.
3. **Given** a phone-width screen, **When** the header is displayed, **Then** Assistant, Account, and Sign out remain usable.

### User Story 2 - Upload a procedure document (Priority: P1)

An employee uploads a text-based procedure PDF. The assistant immediately receives the extracted context in the current conversation, displays the file name and text it used, and asks the employee to confirm a recognized procedure before estimating.

**Why this priority**: The employee can work from their existing paperwork instead of retyping clinical terms.

**Independent Test**: Upload a small text-based PDF mentioning a supported procedure and see its context and a confirmation question in the same conversation.

**Acceptance Scenarios**:

1. **Given** a signed-in user with an open conversation, **When** they upload a supported PDF, **Then** a document message appears and the assistant continues in that conversation.
2. **Given** text naming one supported procedure, **When** extraction completes, **Then** the assistant asks the user to confirm it before any estimate.
3. **Given** several possible procedures, **When** extraction completes, **Then** the assistant offers the supported candidates without silently choosing one.
4. **Given** an image-only PDF, **When** extraction finds no selectable text, **Then** the user sees a scan-specific explanation and the existing chat remains usable.

### User Story 3 - Continue after an answer (Priority: P2)

The employee can ask about remaining benefits, estimates, network differences, nearby dentists, or plan-reset timing, then change or clarify the topic without restarting the assistant.

**Why this priority**: The assistant should handle ordinary follow-up questions as a conversation.

**Independent Test**: Ask for an estimate, change network, ask for remaining benefits, and return to the estimate without losing signed-in plan context.

**Acceptance Scenarios**:

1. **Given** an estimate, **When** the user asks to change network, **Then** the assistant requests or applies the new network and recalculates through the plan engine.
2. **Given** an unclear request, **When** the assistant cannot identify a supported action, **Then** it asks a concrete clarification and offers relevant choices.
3. **Given** a completed answer, **When** the user asks about another supported topic, **Then** the assistant routes there within the same session.

### Edge Cases

- Reject files that are not PDFs, exceed 5 MB, exceed 20 pages, are corrupt, or cannot be read; keep the conversation unchanged.
- A PDF may mention multiple procedures, no supported procedure, prices, or purported policy terms. Ask for a procedure confirmation; do not turn document claims into plan facts.
- Failed upload or chat handoff shows a retryable error without erasing user messages.
- Sign-out prevents document submission and access to account data.
- Recent-visit chat prompts and account behavior remain unchanged.

## Requirements

### Functional Requirements

- **FR-001**: The signed-in header MUST provide Assistant, Account, and Sign out controls, visibly identify the current page, and work on narrow screens.
- **FR-002**: Switching between Assistant and Account MUST preserve an open live conversation.
- **FR-003**: The assistant MUST let a signed-in user upload a PDF of at most 5 MB and at most 20 pages from the chat composer.
- **FR-004**: The system MUST extract selectable text without storing the PDF or extracted text after the request. It MUST NOT require a separate review action before sending the result into the conversation.
- **FR-005**: The conversation MUST show the document name and the bounded excerpt used. It MUST confirm a supported procedure before estimating from document context.
- **FR-006**: The system MUST handle zero, one, or multiple recognized supported procedures with a specific next question or choices.
- **FR-007**: The system MUST give clear errors for invalid, oversized, unreadable, and image-only PDFs and leave the conversation usable.
- **FR-008**: Assistant answers about benefit amounts and procedure costs MUST use the signed-in user's existing plan and shared calculation model; document text MUST NOT override those values.
- **FR-009**: The live conversation MUST support follow-ups among benefits, estimates, network comparison, dentist finding, and plan-reset timing without forcing a restart.
- **FR-010**: Unclear or unsupported language MUST produce a clarifying question and supported next actions.
- **FR-011**: Existing recent-visits behavior MUST remain unchanged.

### Key Entities

- **Procedure document**: Temporary upload with a file name, size, page count, bounded extracted excerpt, and zero or more supported procedure candidates.
- **Conversation**: Signed-in session holding the current topic and any pending procedure confirmation.
- **Plan context**: The existing company plan and recorded employee usage used to calculate benefits and estimates.

## Success Criteria

### Measurable Outcomes

- **SC-001**: A signed-in user can move Assistant → Account → Assistant in three actions while retaining the same conversation.
- **SC-002**: A valid one-page text PDF naming a supported procedure reaches a confirmation prompt in one upload action.
- **SC-003**: Each invalid or scanned PDF case displays a specific outcome and permits another chat message without a restart.
- **SC-004**: The follow-up scenario in User Story 3 completes in one continuous conversation and all shown amounts match the shared benefits result.

## Assumptions

- The first version supports PDFs with selectable text; scanned images require OCR and are outside this feature.
- Uploaded documents may contain sensitive personal information, so the service processes them in memory and does not retain their contents.
- The existing signed-in user, company, and plan context are authoritative.
