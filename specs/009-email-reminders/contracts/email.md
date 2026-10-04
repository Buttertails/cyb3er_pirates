# Email Contract: Account Reminder Emails

## Configuration

| Variable | Required | Notes |
|---|---|---|
| `RESEND_API_KEY` | yes (live) | Secret Manager `resend-api-key`. Never committed. |
| `REMINDER_FROM_EMAIL` | yes (live) | Address on a domain verified with Resend, e.g. `Dental Deal Detector <reminders@example.com>`. |
| `APP_SIGN_IN_URL` | yes (live) | Must start with `https://`, e.g. `https://cyb3r-pirates.web.app/index.html`. |
| `REMINDER_JOB_AUDIENCE` | yes | The direct Cloud Run URL. |
| `REMINDER_JOB_SERVICE_ACCOUNT` | yes | The Scheduler's OIDC service-account email. |
| `REMINDER_ALLOW_UNVERIFIED` | no | `true` lets the demo send to unverified addresses. Default `false`. |
| `REMINDER_BENEFITS_LEAD_MONTHS` | no | Default `3`; allowed 1–11. |
| `REMINDER_BENEFITS_REMAINING_PERCENT` | no | Default `90`; allowed 1–100. |

If any live variable is missing, non-dry runs return 503 and send nothing.

## Request to Resend

- `POST https://api.resend.com/emails`
- Headers: `Authorization: Bearer <key>`, `Content-Type: application/json`, `Idempotency-Key: <campaign>-reminder/<sha256(uid\0key)>`.
- Body: `{"from", "to": [address], "subject", "text", "html"}`, serialized as compact UTF-8 with stable key order so a retry sends the identical payload.
- Timeout: 8 seconds.

## Templates

### Inactivity: subject "Please review your dental profile"

- It's been about 90 days since the user last signed in to Dental Deal Detector.
- Asks them to sign in and review their dental history; if nothing has changed, confirming takes a few seconds.
- One link: `APP_SIGN_IN_URL`.

### Benefits: subject "Your dental benefits reset soon"

- "You still have most of your dental benefits for the {plan year} plan year."
- "Unused benefits don't roll over — they reset on {Month D, YYYY}."
- One link: `APP_SIGN_IN_URL` with `reminder=benefits` added. Any existing query string and fragment are kept.

### Both emails

- A privacy line: the email has no dental-history or plan details, and if it was unexpected the reader should open the app directly instead of using the link.
- A line saying this is a demonstration app with fictional plan data.
- HTML: values are escaped; no images, tracking pixels or remote resources.
- Never included: `$`, dollar amounts, procedure names, care dates, uid, idempotency key, provider key.

## Failure codes (`failure_code`)

| Code | Retryable | Uncertain | Cause |
|---|---|---|---|
| `retryable_rate_limit` | yes | no | HTTP 429 |
| `retryable_provider` | yes | yes | HTTP 5xx |
| `retryable_concurrent` | yes | yes | 409 `concurrent_idempotent_requests` |
| `idempotency_conflict` | no | no | 409 `invalid_idempotent_request` or any other 409 |
| `permanent_request` | no | no | Other 4xx |
| `retryable_transport` | yes | yes | Network error or timeout |
| `invalid_provider_response` | yes | yes | Unparseable body or missing `id` |
| `retry_limit` | no | — | 5 certain attempts exhausted |
| `idempotency_window_expired` | no | — | An uncertain or interrupted send 23h+ after its first attempt (`delivery_unknown`) |

Skip codes on `skipped_auth` records: `disabled`, `missing_email`, `unverified_email`, `missing_account`, `auth_lookup_failed`.

Provider response bodies, API keys and addresses are never logged or stored.
