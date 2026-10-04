# Nearby dentists contract

## Signed-in request

`GET /api/me/dentists`

Requires the existing Firebase ID token. The server derives company and ZIP
from the verified account profile. No query parameters select a company,
employee, plan, location or another user.

### Success

HTTP 200:

```json
{
  "status": "ok",
  "message": "Sample in-network offices near your saved ZIP.",
  "offices": [
    {
      "id": "sample-office-1",
      "name": "Example Dental",
      "address": "Example street address",
      "rating": 4.6,
      "phone": "202-555-0101",
      "distance_miles": 2.3,
      "maps_url": "https://www.google.com/maps/search/?api=1&query=35.78%2C-78.64"
    }
  ]
}
```

The `maps_url` coordinates above illustrate shape only; implementation uses
each office's own coordinates. Results are sorted by
unrounded distance ascending, then ID, and truncated to five. The response
contains no account identifier or private profile fields.

### Empty outcomes

HTTP 200 with `offices: []` and one of:

- `missing_zip`: user should save a ZIP through the existing location flow.
- `unsupported_zip`: saved ZIP is outside seeded test areas; offer location
  change.
- `unknown_plan`: saved company has no supported sample plan.
- `no_offices`: seeded ZIP is supported but this plan has no nearby sample
  offices.

Each response includes an appropriate short `message`. The chat renders the
message without a fictional fallback.

### Errors

- HTTP 401: no valid signed-in account.
- HTTP 503: profile/directory service unavailable or fixture invalid. The
  chat shows retry and no stale list.

## Frontend behavior

The signed-in chat has a Find in-network dentists action. During the request,
disable duplicate requests and show loading. On `ok`, render the card fields
as sample data. On an empty outcome, show the returned next step. On 401,
follow existing sign-out behavior; on 503 or network failure, show retry.
The onboarding office picker uses the same office IDs and directory details
for supported ZIPs.
