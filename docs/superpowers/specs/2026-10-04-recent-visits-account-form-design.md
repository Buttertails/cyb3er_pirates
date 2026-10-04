# Recent visits as an account form

## Goal

Let signed-in employees record completed dental visits through a dedicated account page. The benefits assistant should use saved visits when estimating remaining benefits, but should not interview the employee about past visits in the chat box.

## Experience

- Add a **Recent visits** page under the signed-in account/profile area. It shows saved completed visits and a simple **Add visit** form. Profile's existing **Update recent visits** action opens this page.
- The form uses the existing supported procedure choices, visit month/date, and optional total cost, amount paid by the employee, and amount paid by insurance. Save through the existing completed-care API and show the new visit in the list and benefit balance. Do not treat a planned estimate as a completed visit.
- On a stale sign-in, present an optional account-page prompt asking whether the employee has any visits to add. **Add visits** opens the form; **Skip for now** continues to benefits chat. Neither choice requires talking to the assistant. The prompt is shown at most once for that stale sign-in.
- Remove the `procedures`, `work-*` recent-care questions from the guided chat path. The assistant can still answer questions about the saved balance and planned care.
- Keep other account/profile and guided location flows. A saved visit remains tied to the authenticated account and current company plan; no demo employee selector appears.

## Data and scope

Reuse the existing Firestore completed-care reports and `GET/POST /api/me/procedures`; no new collection or claim-processing integration. Use existing backend validation and the shared benefits calculator. Failed saves keep entered form values and show the backend error. No edit/delete of prior reports is included in this first pass.

## Verification

- A new visit saved in the form appears in account history and changes the remaining-benefits amount used by the chat.
- Stale sign-in, manual profile entry, and Skip for now work without a recent-visits chat question.
- Existing account history and estimates remain available.
