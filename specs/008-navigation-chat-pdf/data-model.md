# Data model

## Temporary procedure document

- `filename`: display name, never used as a path.
- `size_bytes`: positive integer, at most 5 MB.
- `page_count`: integer 1–20.
- `excerpt`: normalized text used in CX, bounded below the current chat limit.
- `candidates`: distinct supported procedure IDs and labels from the existing catalog.
- Lifetime: request memory and active browser conversation only; no Firestore record.

## Active conversation

- Existing signed-in employee ID and signed CX session token.
- Current message history and choices held in parent React memory.
- Optional document preview with filename and exact excerpt used.
- Clear on sign-out or account change; preserve across Assistant/Account navigation.

## Plan context

- Existing one-plan-per-company policy and employee usage from current backend sources.
- Neither PDF text nor CX output mutates plan or recorded care.
