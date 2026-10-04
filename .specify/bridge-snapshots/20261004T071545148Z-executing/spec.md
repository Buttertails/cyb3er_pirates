# Feature Specification: Dentist lookup in conversation

**Source**: `docs/superpowers/specs/2026-10-04-nearby-dentists-design.md` (approved 2026-10-04 amendment)

## User Story 1 — Ask for dentists in chat

A signed-in employee can type a natural request such as “find in-network dentists near me” at any point in the live benefits conversation. The assistant shows the existing ranked, fictional dentist cards in the chat instead of relying on a separate button.

### Acceptance scenarios

1. From the opening prompt, an employee asks for in-network dentists; the assistant shows the same directory result as the existing lookup, using that account's saved company and ZIP.
2. From an estimate or procedure question, the same request works without losing the signed-in account context.
3. The result remains in the chat log and the employee can ask about a procedure afterward without restarting.
4. The standalone Find in-network dentists button is absent.

## User Story 2 — Honest unavailable states

The assistant gives the existing missing ZIP, unsupported area, no match, and temporary failure messages when the directory cannot produce offices. It never invents a provider.

## Requirements

- **FR-001**: Natural dentist lookup phrases MUST be recognized by the live Dialogflow agent from each active conversation stage.
- **FR-002**: The directory result MUST use the authenticated account's stored company and ZIP and the existing sample directory, never company or ZIP supplied only in chat text.
- **FR-003**: The live chat MUST display the existing dentist cards with name, sample rating, phone, approximate distance, address, and maps link.
- **FR-004**: The chat MUST remain usable for further benefit questions after a dentist lookup.
- **FR-005**: The separate dentist lookup button MUST be removed.
- **FR-006**: Existing estimate, network, completed-care, and sign-in behavior MUST continue to work.

## Success criteria

- All tested lookup phrases reach the directory from the opening, procedure, network, and estimate stages.
- No tested lookup returns another plan's offices or fabricates a result for an unsupported area.
- The employee can continue with an estimate after viewing dentists.

## Assumptions and limits

This extends the existing fictional directory from feature 006; it does not create live provider data, new account fields, or a profile screen.
