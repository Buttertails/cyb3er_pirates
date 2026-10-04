# Dentist chat contract

When CX invokes webhook tag `dentists.find`, the webhook responds with a `dentist_directory` payload containing the same `status`, `message`, and `offices` shape as `GET /api/me/dentists`. The signed context token supplies UID. `POST /api/chat` then returns `dentists` with that shape alongside existing `session_id`, `messages`, and `choices`. A non-lookup chat turn returns `dentists: null`. The client renders `dentists` using `DentistResults` and does not call the separate lookup API from a button.
