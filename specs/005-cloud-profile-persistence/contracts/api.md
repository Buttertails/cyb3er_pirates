# API contract

All `/api/me*` and `/api/chat` requests require `Authorization: Bearer <Firebase ID token>`. UID is derived from the token. Errors are JSON: validation 422, conflict 409, missing auth 401, unavailable service 503.

- `GET /api/me` → `{uid,email,name,company,office,location,last_sign_in_at}` with nulls when unset.
- `PATCH /api/me` accepts a nonempty subset of `{name,company,office}` and returns the profile. Other fields are rejected.
- `PUT /api/me/location` accepts `{state,zip}` and returns profile without removing other fields.
- `POST /api/me/sign-in` accepts `{}` and returns profile with updated `last_sign_in_at`.
- `GET /api/me/procedures?employee_id=...` → `{procedures:[...]}` for that account and employee.
- `POST /api/me/procedures` accepts `{employee_id,procedures:[{submission_id,procedure,category,date,cost,you_paid,insurance_paid}]}`; date is `YYYY-MM`, money is decimal dollars or null. Empty list is a no-op. The entire batch is validated and committed atomically; same-ID retries are idempotent and conflicting batches make no changes. The per-year known insurer-payment total cannot exceed the selected plan's annual allowance even under concurrent requests.
- `GET /api/me/benefits?employee_id=...` returns the selected employee's identity and live annual summary for the signed-in account.
- `POST /api/me/estimate` accepts `{employee_id,procedure_id,network?,as_of?}` and returns a shared-engine estimate using the same plan and confirmed usage as live chat. An estimate does not record care.
- `POST /api/chat` retains its body/response contract but requires auth and binds its session to verified UID. Old UID-free sessions return 409 with restart guidance. `benefits` and `estimate` include confirmed reports for this user and employee.

Browser requests cannot set UID, plan, company or calculated balance for a report.
