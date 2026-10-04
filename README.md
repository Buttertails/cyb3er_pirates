# Dental benefits assistant

### Run the React frontend

Install the frontend dependencies and start Vite:

```bash
cd frontend
npm install
npm run dev
```

Then open the URL Vite prints. Login and sign-up use the Firebase web
configuration in `frontend/js/firebaseConfig.json`. Enable the Email/Password
provider in the Firebase console before creating accounts. The Flask backend
must be running for profile, care history, chat, and estimates.

For a local UI-only demo that bypasses Firebase Auth, set `DEMO_LOGIN` to `true`
in `frontend/src/lib/storage.js`. Keep it `false` to use Firebase Authentication.

### Run Flask locally

Install `backend/requirements.txt`, then run `python backend/main.py`. Vite
proxies `/api` to Flask on port 8080. Firebase Auth and Firestore require
credentials or emulators as described in `backend/main.py`.

### Deploying

Turn on the Email/Password sign-in provider in the Firebase console. Firebase
Authentication uses `frontend/js/firebaseConfig.json` on both local and
deployed sites. Keep the default project in `.firebaserc` aligned with the
config's `projectId`; the backend verifies tokens for that project.
Build React with `npm --prefix frontend run build`, deploy Flask to the existing
`dental-api` Cloud Run service, then deploy Firebase Hosting. Hosting rewrites
`/api/**` to Cloud Run and serves the React build for other paths.

### Planned features

- **Provider finder:** Let an employee find fictional dental offices by location,
  plan network, procedure or specialty, and appointment availability. Keep
  directory entries clearly labeled as demo data until a verified provider
  directory is available.
- **Proposed-care paperwork upload:** Accept a dentist's treatment plan or cost
  estimate, extract supported procedure descriptions or codes, and ask the
  employee to confirm or correct them before calculating coverage. Unsupported
  or unclear items must stay unpriced until clarified.
- **Completed-care paperwork upload:** Accept a claim or explanation of benefits,
  show the extracted completed services and amounts for employee review, then
  offer an explicit action to record confirmed usage. Uploading a document alone
  must never change recorded benefits usage.
