# Landing Contract: Benefits Reminder Link

## URL

`{APP_SIGN_IN_URL}?reminder=benefits`

- The only allowlisted value is `benefits`. Anything else, including inherited object keys like `__proto__`, is ignored.
- The parameter carries no identity, token or destination path. It is not a redirect target.

## Sign-in page (`/index.html`)

1. On every entry path, the page reads `reminder` from the query string and saves it as the session step `reminder`. Those paths are:
   - submitting the form
   - hydrating a persisted Firebase session
   - resuming an existing browser session
2. While the marker is present, the page shows "Sign in to see how much of your dental benefit is left."
3. After the profile loads, the user goes to the first of these that applies:
   1. **Onboarding unfinished**: the first unanswered onboarding page. The sign-in is recorded now.
   2. **Stale sign-in** (more than 90 days): `startUpdate('stale', destination)`. The sign-in is recorded when the update finishes, and the update returns to the destination.
   3. **Otherwise**: the sign-in is recorded and the user goes to the destination.

   The destination is `/profile.html` when the marker is `benefits`, and `/chat` otherwise.

## Profile page

- Reads the `reminder` marker once on mount, then clears it.
- When the marker was `benefits` and `GET /api/me/benefits` returns a finite maximum with an amount remaining, it shows:

  `<p class="note" role="status">You still have $X of your $Y annual dental benefit for this plan year. Unused benefits reset on Month D, YYYY.</p>`

- Shows no notice for an unlimited plan, nothing remaining, or missing data.
- Dates are formatted from `YYYY-MM-DD` as local calendar dates, so the notice never shows the previous day.
