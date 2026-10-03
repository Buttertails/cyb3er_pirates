# Frontend JSON messages

What the frontend sends at each step of the intake flow, and what the backend
must do and return in response. The frontend is plain HTML/CSS/JS in `frontend/`.

**Status:** a proposal from the frontend side, for the team to review. The
message shape and event names are not yet defined in
[the API contract](../specs/001-dental-benefits-assistant/contracts/api.md); see
[Open points](#open-points-to-settle-with-the-api-contract) at the end.

Source of truth for the allowed values is `frontend/js/options.js`. The message
code is `frontend/js/api.js`.

## At a glance

Each answer is sent as its own message, as soon as the user completes that step.
The backend answers each with JSON. Five messages are sent on every path.

| # | Event | User action | Backend must return |
| --- | --- | --- | --- |
| 1 | `intake.location` | Enters state and optional ZIP | `session_id` and **`offices`** (dentist offices near the location) |
| 2 | `intake.office` | Picks an office from the list | `session_id` |
| 3 | `intake.category` | Picks a care category | `session_id` |
| 4 | `intake.procedure` | Picks a procedure within the category | `session_id` |
| 5 | `intake.timing` | Picks when they need it, or the app sets it to `asap` for emergencies | `session_id` |

The review page and the temporary summary page send nothing. The sign-in page and
the location step also call the profile routes, which are not `intake.*`
messages; see [Authentication](#authentication) and
[Profile and location](#profile-and-location).

## How messages are sent

- `POST` with `Content-Type: application/json` to `/api/chat` (same origin).
  The path is `API_CONFIG.endpoint` in `api.js`.
- Messages are sent one at a time, in order. The frontend waits for a successful
  response before moving the user to the next page.
- **Local demo mode is the default** (`API_CONFIG.mode = 'local_demo'`). Nothing
  leaves the browser. Messages are logged to the console and acknowledged
  locally, and fictional placeholder offices are generated. Set the mode to
  `'live'` to send real requests.
- The 18-second timeout comes from the API contract.
- Every request carries the signed-in user's Firebase ID token as
  `Authorization: Bearer <token>`. See [Authentication](#authentication).

### Request envelope

```json
{
  "session_id": "6b7d512e-be20-4766-9406-c1be2ac0265f",
  "event": {
    "name": "intake.category",
    "parameters": { "category": "general" }
  },
  "auto_set": true
}
```

| Field | Type | Notes |
| --- | --- | --- |
| `session_id` | string | **Omitted on the first message.** The backend creates it and returns it; the frontend sends it on every later message. |
| `event.name` | string | One of the five event names above. |
| `event.parameters` | object | The answer. Keys are listed per step below. |
| `auto_set` | boolean | Present only as `true`, on the emergency timing message. It means the app chose the value, not the user. |

The message body carries no employee ID, user name or credentials. The backend
learns who is asking from the ID token in the `Authorization` header.

### Response envelope

Every successful response is `200` with a JSON body:

```json
{ "session_id": "6b7d512e-be20-4766-9406-c1be2ac0265f" }
```

- `session_id` is **required**. The frontend stores whatever the latest response
  returns and sends it next time.
- Step 1 also returns `offices` (below). Other fields are ignored for now.

### Errors

Any non-2xx status, network failure or timeout is treated as "not sent". The
user stays on the page, sees "We couldn't send that just now. Please try again.",
and can resend the same message. Two statuses are handled differently:

- `401`: the user is signed out of Firebase and sent back to the sign-in page,
  which says they were signed out.
- `422`: the `error` text from the body is shown instead of the retry message.

Otherwise the frontend does not read the error body. The contract's
`{ "error": { "code", "message", "fields" } }` envelope is welcome and will be
used once the frontend shows field-level messages.

### Rules that apply to every step

- **Idempotent, last write wins.** A step can be sent again with the same or a
  new value, whether from a retry or because the user went back with a "Change"
  link. Overwrite that step's stored answer; never append.
- **Validate everything.** The frontend checks values but can be bypassed.
  Reject unknown IDs with `422`.
- **Per-session state.** Keep, per session: location, the offices that were
  offered, the chosen office, category, procedure and timing.
- **No end-of-session message.** "Start over" discards the session on the
  frontend only. Expire idle sessions on the backend.
- Location plus the chosen procedure is sensitive. Use HTTPS outside local development.

---

## Step 1: Location, `intake.location`

Sent when the user submits "Where are you located?". The location is saved to
the user's profile first (`PUT /api/me/location`, see
[Profile and location](#profile-and-location)), so the page is shown only once
per user. On later sign-ins the saved location is sent as this message straight
away, without showing the page, so the backend still returns the offices.

```json
{
  "event": {
    "name": "intake.location",
    "parameters": { "state": "TX", "zip": "78701" }
  }
}
```

| Parameter | Type | Rules |
| --- | --- | --- |
| `state` | string | Required. A 2-letter code: the 50 states plus `DC` (51 values, list below). |
| `zip` | string or `null` | 5 digits, or `null` when the user left it blank. |

`null` means "no ZIP". Treat it as clearing any ZIP stored earlier in the session.

**The frontend already checks** that `state` is chosen, that `zip` is 5 digits,
and that the ZIP's first three digits are consistent with the state. That last
check uses an approximate table typed in from memory, so it is a convenience only.

### Backend must

1. Create a session if `session_id` is absent, and return its `session_id`.
2. Validate `state` and `zip`. Re-check that the ZIP belongs to the state, since
   the frontend check is approximate and bypassable. Return `422` on a mismatch.
3. **Look up dentist offices near this location** and return them as `offices`.
4. Store the location and the list of offered offices on the session.
5. If a different location replaces an earlier one, drop a stored `office` choice
   that is not in the new list. The frontend does the same.

### Response

```json
{
  "session_id": "6b7d512e-be20-4766-9406-c1be2ac0265f",
  "offices": [
    {
      "id": "office-1042",
      "name": "Example Family Dental",
      "address": "100 Example Street, Austin, TX 78701",
      "distance_miles": 1.2
    }
  ]
}
```

| Office field | Type | Required | Notes |
| --- | --- | --- | --- |
| `id` | string | yes | Stable and unique within the list. Sent back in step 2. |
| `name` | string | yes | Shown as the card title. |
| `address` | string | no | One display line, shown as-is. |
| `distance_miles` | number | no | Shown as "1.2 mi away" when present. |

- The frontend displays offices **in the order returned**, so sort nearest first.
- Keep the list short, about 10 or fewer. It is rendered as a flat list with no paging.
- An empty `offices` array, or a missing one, makes the page say no offices
  were found and ask the user to change their location. Use it for locations with no coverage.
- Text is shown with `textContent`, so HTML in these fields is not rendered.

---

## Step 2: Office, `intake.office`

Sent when the user picks a dental office.

```json
{
  "session_id": "6b7d512e-be20-4766-9406-c1be2ac0265f",
  "event": {
    "name": "intake.office",
    "parameters": { "office": "office-1042" }
  }
}
```

| Parameter | Type | Rules |
| --- | --- | --- |
| `office` | string | Required. Must be the `id` of an office returned for this session's location. |

### Backend must

1. Check `office` is one of the offices offered in this session. Otherwise `422`.
2. Store it. Return `session_id`; nothing else is needed.

---

## Step 3: Care category, `intake.category`

```json
{
  "session_id": "6b7d512e-be20-4766-9406-c1be2ac0265f",
  "event": {
    "name": "intake.category",
    "parameters": { "category": "general" }
  }
}
```

| Parameter | Type | Rules |
| --- | --- | --- |
| `category` | string | Required. One of the category IDs below. |

### Backend must

1. Validate `category`.
2. Store it. **If the category changed, discard the stored `procedure`, and
   discard `timing` if the old category was `emergency`.** The frontend clears
   these on its side and asks the user again, so new `intake.procedure` and
   `intake.timing` messages follow.
3. Return `session_id`.

---

## Step 4: Procedure, `intake.procedure`

```json
{
  "session_id": "6b7d512e-be20-4766-9406-c1be2ac0265f",
  "event": {
    "name": "intake.procedure",
    "parameters": { "procedure": "root-canal" }
  }
}
```

| Parameter | Type | Rules |
| --- | --- | --- |
| `procedure` | string | Required. Must be one of the procedure IDs **listed under the stored category**. |

### Backend must

1. Check the procedure belongs to the session's category. Otherwise `422`.
2. Store it and return `session_id`.
3. If the category is `emergency`, expect an `intake.timing` message right after
   (Step 5). The frontend sends both back to back.

---

## Step 5: Timing, `intake.timing`

Normal path, chosen by the user:

```json
{
  "session_id": "6b7d512e-be20-4766-9406-c1be2ac0265f",
  "event": {
    "name": "intake.timing",
    "parameters": { "timing": "two-weeks" }
  }
}
```

Emergency path, set by the app because emergency work is always urgent, so the
user is never asked:

```json
{
  "session_id": "6b7d512e-be20-4766-9406-c1be2ac0265f",
  "event": {
    "name": "intake.timing",
    "parameters": { "timing": "asap" }
  },
  "auto_set": true
}
```

| Parameter | Type | Rules |
| --- | --- | --- |
| `timing` | string | Required. One of the timing IDs below. |

### Backend must

1. Validate `timing`.
2. For `auto_set: true`, the value is always `asap` and the session's category
   is always `emergency`. Record that the timing was implied, not chosen.
3. Return `session_id`. This is the last message. The flow is complete once all
   five answers are stored. Nothing else is sent when the user clicks Submit.

---

## Allowed values

Defined in `frontend/js/options.js`.

**`state`:** AL AK AZ AR CA CO CT DE DC FL GA HI ID IL IN IA KS KY LA ME MD MA
MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV
WI WY

**`category` and the `procedure` values allowed under each:**

| `category` | Label | Allowed `procedure` values | Timing auto-set |
| --- | --- | --- | --- |
| `checkup` | Cleaning or checkup | `cleaning`, `exam-xrays`, `deep-cleaning` | no |
| `general` | General toothwork | `filling`, `crown-bridge`, `root-canal`, `extraction`, `implant`, `dentures`, `orthodontics`, `cosmetic`, `other` | no |
| `emergency` | Emergency work | `severe-pain`, `broken-tooth`, `swelling`, `lost-filling`, `bleeding`, `urgent-other` | yes, `asap` |

**`timing`:**

| `timing` | Label |
| --- | --- |
| `asap` | As soon as possible |
| `two-weeks` | Within 2 weeks |
| `one-to-three-months` | 1 to 3 months |
| `three-to-six-months` | 3 to 6 months |
| `six-months-plus` | 6 months or more |
| `not-sure` | Not sure yet |

These IDs are placeholders the team will likely change. Update `options.js` and
this table together.

## Example sessions

**Normal path:**

```text
1. intake.location   { state: "TX", zip: "78701" }       -> session_id + offices
2. intake.office     { office: "office-1042" }           -> session_id
3. intake.category   { category: "general" }             -> session_id
4. intake.procedure  { procedure: "root-canal" }         -> session_id
5. intake.timing     { timing: "two-weeks" }             -> session_id
```

**Emergency path** (the user sees one fewer page, but five messages are still sent):

```text
1. intake.location   { state: "PA", zip: null }          -> session_id + offices
2. intake.office     { office: "office-2210" }           -> session_id
3. intake.category   { category: "emergency" }           -> session_id
4. intake.procedure  { procedure: "broken-tooth" }       -> session_id
5. intake.timing     { timing: "asap" }, auto_set: true  -> session_id
```

When a user goes back with a "Change" link, the pages after the change send
their messages again, so the same event can arrive more than once in a session.

## Backend checklist

- [ ] One route that accepts these messages and returns `200` JSON with `session_id`
- [ ] Session creation, and per-session storage of all five answers plus the offered offices
- [ ] **Office lookup by state and ZIP, returning `offices` on `intake.location`**
- [ ] Validation of state, ZIP against state, office against the offered list, procedure against category, and timing
- [ ] Overwrite semantics on repeats, and clearing stale `office`, `procedure` and `timing` as described above
- [ ] `422` for invalid input and `503` when the service is unavailable
- [ ] Idle-session expiry

## Authentication

Users sign in on `index.html` with Firebase Authentication, using email and
password. The same page creates accounts. `frontend/js/firebase.js` loads the
Firebase JS SDK from the gstatic CDN, with no build step:

- On `localhost` or `127.0.0.1` it uses the Auth emulator
  (`firebase emulators:start`), so no real accounts or config file are needed.
- Deployed on Firebase Hosting, it reads the web config from the reserved
  `/__/firebase/init.json` URL. The Email/Password provider must be enabled in
  the Firebase console.

The browser keeps only the signed-in email in `sessionStorage`, to show who is
signed in. Firebase keeps its own sign-in state. "Sign out" ends both and discards
the session's answers.

How the backend sees the user:

- **Credentials never travel in the `intake.*` messages.** Every backend call
  sends `Authorization: Bearer <Firebase ID token>`. The backend verifies it
  (`backend/auth.py`) and uses the token's `uid` to identify the user.
- A missing, invalid or expired token gets `401 {"error": "sign-in required"}`.
  The frontend then signs the user out and returns to the sign-in page.

## Profile and location

The backend remembers each user's location in Firestore at `users/{uid}`, so it
is asked for once. These routes are always live, even in local demo mode, and
both need the `Authorization` header.

### `GET /api/me`

```json
{ "uid": "Xy12...", "email": "pat@example.com", "location": { "state": "TX", "zip": "78701" } }
```

`location` is `null` until the user has saved one. After signing in, the frontend
calls this route:

- With no location, it shows the location step.
- With a location, it skips that step. It sends the location as
  `intake.location` to get the offices, then goes to the office step.

### `PUT /api/me/location`

```json
{ "state": "TX", "zip": "78701" }
```

Same rules as [Step 1](#step-1-location-intakelocation): `state` is one of the
51 codes, and `zip` is 5 digits or `null`. The backend re-checks the ZIP against
the state with a copy of the frontend's prefix table (`backend/dental/locations.py`).

- Invalid input returns `422` with a readable `error`.
- On success it returns the same shape as `GET /api/me`.
- Last write wins. The "Change" link on the review page leads back to the
  location step, which saves the new location.

## Open points to settle with the API contract

The frontend was built on its own flow, so these differ from
[`specs/001-dental-benefits-assistant/contracts/`](../specs/001-dental-benefits-assistant/contracts/api.md).

1. **Message shape.** `POST /api/chat` is documented as taking exactly one of
   `text` or `event`, and does not define step events. The `intake.*` names, and
   `event` being an object with `parameters`, are proposed here and need agreeing
   with the Dialogflow flow.
2. **`employee_id`.** The contract requires it on `/api/chat`. The frontend sends
   none: the Firebase `uid` from the ID token identifies the user. Mapping a user
   to an employee and plan is still open.
3. **Offices vs. `choices`.** The contract returns options as a `choices`
   array of label/value pairs. Offices need an address and distance, so this doc
   uses a richer `offices` array. They could be merged, or offices could ride in
   `choices` with extra fields.
4. **Different questions.** The contract's flow collects procedure, network and a
   date. This frontend collects location, office, care category, procedure and a
   rough timeframe. Nothing here sends a network or a date.
5. **IDs.** The contract expects procedure IDs from the fixture data. The ones
   above are placeholders from `options.js`.
6. **Expired sessions.** If the backend does not recognize a `session_id`, the
   frontend has no recovery path. If the response carries a new `session_id` it
   will adopt it, but earlier answers will be missing until sent again.
