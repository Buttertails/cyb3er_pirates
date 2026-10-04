# Document and chat contract

## Upload

`POST /api/chat/document` requires existing Firebase bearer authentication and `multipart/form-data` fields `file`, `employee_id`, and optional `session_id`.

- PDF is at most 5 MB and 20 pages.
- The signed-in plan and session context are verified as in `/api/chat`.
- Successful response has normal `/api/chat` fields plus `document`:

```json
{"document":{"filename":"treatment-plan.pdf","page_count":1,"excerpt":"Orthodontic treatment: braces","candidates":[{"value":"orthodontics","label":"Orthodontics"}]}}
```

The server sends the bounded excerpt and candidate IDs into the current CX session with a `document.uploaded` event. CX asks for confirmation before estimating. The document is not stored. A failed upload adds no chat message.

Errors: `401` signed out; `413` too large; `415` wrong type; `422` empty, corrupt, encrypted, too many pages, or no selectable text; `503` extraction or chat unavailable. Use the existing API error shape.

## Navigation and follow-ups

Header links use existing Assistant and Account routes. Session and visible messages survive route navigation in one tab. CX supports procedure selection, changing network, benefits, nearby dentists, and plan-reset guidance without a new session. Only the backend calculator supplies financial values.
