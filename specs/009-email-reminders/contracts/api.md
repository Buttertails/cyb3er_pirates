# API Contract: Account Reminder Emails

## `POST /api/me/sign-in` (changed)

- **Auth**: Firebase ID token (`require_user`).
- **Body**: exactly `{}`; any other body returns 422.
- **Effect**: merges `{email, last_sign_in_at: <server UTC timestamp>, inactivity_cycle_id: <new UUID4>}` into `users/{uid}`.
- **Response 200**: the same shape as `GET /api/me`.
- **When the frontend calls it**:
  - After a normal sign-in.
  - Right after account creation, to set the baseline.
  - At the end of a stale-sign-in update.

## `GET /api/me` (unchanged shape)

`last_sign_in_at` is an ISO-8601 string or `null`, whether the stored value is a timestamp or a legacy string.

## `POST /api/internal/reminders/run` (new)

- **Auth**: `Authorization: Bearer <Google OIDC token>`. The token is checked against:
  - `REMINDER_JOB_AUDIENCE`, the expected audience (the direct Cloud Run URL)
  - `REMINDER_JOB_SERVICE_ACCOUNT`, the exact service-account email, which must have `email_verified=true`

**Body** (every field optional):

```json
{"campaigns": ["inactivity", "benefits"], "batch_size": 25, "dry_run": false}
```

- `campaigns`: a non-empty list drawn from `inactivity` and `benefits`, without duplicates. Defaults to both. They always run in the order inactivity, then benefits.
- `batch_size`: an integer of at least 1 (not a boolean). Values above 25 are clamped to 25. It is the maximum number of sends per campaign.
- `dry_run`: a boolean. When `true`, nothing is written or sent and `would_send` is counted.
- Unknown keys are rejected.

**Response 200** (counts only; never emails, uids or keys):

```json
{
  "job_run_id": "8c1f…",
  "dry_run": false,
  "incomplete": false,
  "campaigns": {
    "inactivity": {"candidates": 1, "sent": 1, "would_send": 0, "already_terminal": 0,
                   "leased": 0, "skipped_auth": 0, "stale": 0,
                   "retryable_failed": 0, "permanent_failed": 0, "incomplete": false},
    "benefits":   {"candidates": 2, "sent": 2, "...": 0}
  }
}
```

| Status | Meaning |
|---|---|
| 200 | Run finished with nothing left to retry. |
| 401 | Missing or invalid OIDC token. |
| 403 | The token is valid but comes from a different or unverified identity. |
| 422 | Invalid body. |
| 503 | One of: scheduler identity not configured; delivery not configured for a non-dry run (`RESEND_API_KEY`, `REMINDER_FROM_EMAIL`, `APP_SIGN_IN_URL`); a retryable failure; or `incomplete` (batch or time budget reached). Cloud Scheduler retries. |

The legacy, unauthenticated `POST /api/reminders`, which only computes end-of-year text, is unchanged.
