# Navigation, conversation recovery, and procedure PDF intake

## Goal

Make the signed-in dental assistant easier to navigate and let employees upload a procedure PDF so its text becomes useful context in the live conversation. Keep estimates tied to the existing company plan, saved usage, and deterministic calculator. Preserve the current recent-visits workflow.

## User experience

- The header clearly links to **Assistant** and **Account**, shows the current section, and remains usable at phone widths. The account page links back to the assistant. Sign-out remains available. These links do not start or reset a conversation.
- The live assistant offers clear paths to estimate a procedure, check remaining benefits, compare dentist networks, find nearby dentists, and discuss whether a procedure could be scheduled around the plan reset. After an answer, it accepts follow-up questions and changes to procedure or network without forcing a restart. Unsupported or unclear wording gets a useful clarification and suggested next actions.
- The chat composer has an **Upload procedure PDF** action. Selecting a PDF extracts its selectable text and immediately adds the document to the current chat context. The conversation shows the file name and a short extracted-text summary, then asks the employee to confirm the procedure if recognition is ambiguous. The user can continue typing normally while viewing the uploaded document context.
- If no text can be extracted, the chat explains that the PDF appears to be a scan and asks for a text-based PDF or a typed procedure. The first version does not include OCR.

## Data flow and boundaries

- React sends a PDF to a signed-in Flask document endpoint. Flask accepts a PDF of at most 5 MB, validates its file signature, and extracts text in memory from at most 20 pages. It returns a bounded excerpt and supported-procedure candidates; it does not store the PDF or extracted text in Firestore. The frontend passes the result into the current live chat session immediately, without an extra review/submit step.
- A PDF can contain far more text than the current `/api/chat` 1,000-character message limit. The app therefore sends the relevant excerpt and procedure candidates into the conversation, rather than dumping the whole file into Dialogflow. Full extracted text exists only during the extraction request. The user sees what the assistant used.
- Procedure recognition uses the existing catalog and explicit aliases. It does not infer coverage, fees, or medical advice from document prose. The employee confirms a candidate before a calculation. If none is recognized, the assistant asks what procedure the document describes.
- Dialogflow CX handles the conversation and follow-up routes; Flask continues to produce benefits and cost figures from the existing calculator and signed-in profile. Document text is treated as user-provided context, never as policy instructions.
- The existing recent-visit chat and account behavior is unchanged in this feature. No new Firestore collections, account selector, or plan editing are included.

## Delivery order

1. Improve header and account-to-assistant navigation without changing saved data.
2. Add PDF text extraction and the immediate chat handoff, including empty/scanned-file handling.
3. Expand the live Dialogflow conversation routes, wording, and follow-up recovery around the existing benefits, estimate, network, dentist, and reset topics.

Each increment should be independently reviewable. Cloud deployment follows verified code changes; no new cloud resource is required by the design.

## Verification

- A signed-in user moves between Assistant and Account without losing the conversation.
- Uploading a text-based procedure PDF shows its extracted context and leads to a procedure confirmation or a specific clarification in the same live chat session.
- Empty, invalid, oversized, and scanned PDFs produce clear errors and do not change the chat session.
- Plan amounts still come from the backend calculator; a document cannot override plan data.
- Recent-visits behavior remains as it is today.
