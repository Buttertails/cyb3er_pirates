### Run the React frontend

Install the frontend dependencies and start Vite:

```bash
cd frontend
npm install
npm run dev
```

Then open the URL Vite prints. Login and sign-up use the Firebase web
configuration in `frontend/js/firebaseConfig.json`. Enable the Email/Password
provider in the Firebase console before creating accounts. Firebase login and
the intake demo work without the backend. If `/api/me` is unavailable, the app
uses this browser to store the user's profile and location.

For a local UI-only demo that bypasses Firebase Auth, set `DEMO_LOGIN` to `true`
in `frontend/js/shared.js`. Keep it `false` to use Firebase Authentication.

### Run the app locally

The Firebase Hosting and Functions emulators serve the frontend and profile API.
The frontend uses `frontend/js/firebaseConfig.json` for Authentication, so
accounts are created in that configured Firebase project. Do not start the Auth
emulator: the frontend uses the configured project, not the emulator.

You need Node.js, Python 3.12 and Java 21 or newer (for the Firestore emulator).

1. From the repo root, create the backend's virtualenv and install its packages.
   The Functions emulator looks for it at `backend/venv`.

   ```bash
   python3.12 -m venv backend/venv
   backend/venv/bin/pip install -r backend/requirements.txt
   ```

2. Build the React frontend, then start the emulators:

   ```bash
   npm --prefix frontend install
   npm --prefix frontend run build
   npx firebase-tools emulators:start --only hosting,functions,firestore
   ```

   If Java 21 came from Homebrew (`brew install openjdk@21`), it isn't on your
   PATH by default. Point the emulators at it:

   ```bash
   JAVA_HOME=/opt/homebrew/opt/openjdk@21 PATH=/opt/homebrew/opt/openjdk@21/bin:$PATH npx firebase-tools emulators:start --only hosting,functions,firestore
   ```

3. Open http://127.0.0.1:5002, create an account or sign in. The Emulator UI at
   http://127.0.0.1:4000 shows local Firestore data (`users/{uid}`).

Hosting runs on port 5002 because macOS uses port 5000 for AirPlay Receiver.

### Deploying

Turn on the Email/Password sign-in provider in the Firebase console. Firebase
Authentication uses `frontend/js/firebaseConfig.json` on both local and
deployed sites. Keep the default project in `.firebaserc` aligned with the
config's `projectId`; the backend verifies tokens for that project.
