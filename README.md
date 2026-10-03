### Quick start: demo sign-in (until the app is deployed)

Sign-in currently runs in a temporary demo mode locally, so the frontend works on
its own, with no emulators and no backend. Open `frontend/index.html` directly,
or serve the `frontend/` folder with any static server, for example:

```bash
python3 -m http.server 8000 --directory frontend
```

Then open http://127.0.0.1:8000. Any email and password signs in. Each email's
location is remembered in the browser (localStorage), so you're asked for it
only once. A banner on the sign-in page marks demo mode.

Demo mode only applies on `localhost`, `127.0.0.1` or a file opened directly.
A deployed site always uses Firebase. To use real sign-in locally, set
`DEMO_LOGIN` to `false` in `frontend/js/shared.js` and run the emulators as
described below.

### Run the app locally with real sign-in

Everything runs in the Firebase emulators: the Hosting emulator serves the
frontend, the Functions emulator runs the backend, and the Auth and Firestore
emulators hold the accounts and saved locations. You don't need real accounts
or a config file.

You need Node.js, Python 3.12 and Java 21 or newer (for the Firestore emulator).

1. From the repo root, create the backend's virtualenv and install its packages.
   The Functions emulator looks for it at `backend/venv`.

   ```bash
   python3.12 -m venv backend/venv
   backend/venv/bin/pip install -r backend/requirements.txt
   ```

2. Start the emulators:

   ```bash
   npx firebase-tools emulators:start
   ```

   If Java 21 came from Homebrew (`brew install openjdk@21`), it isn't on your
   PATH by default. Point the emulators at it:

   ```bash
   JAVA_HOME=/opt/homebrew/opt/openjdk@21 PATH=/opt/homebrew/opt/openjdk@21/bin:$PATH npx firebase-tools emulators:start
   ```

3. Open http://127.0.0.1:5002, create an account and sign in. The Emulator UI at
   http://127.0.0.1:4000 shows the accounts (Authentication) and saved locations
   (Firestore, `users/{uid}`).

Hosting runs on port 5002 because macOS uses port 5000 for AirPlay Receiver.

### Deploying

Turn on the Email/Password sign-in provider in the Firebase console. Remove the
temporary demo sign-in: `DEMO_LOGIN` in `frontend/js/shared.js`, the demo
profile helpers in `frontend/js/api.js`, and the banner in
`frontend/index.html`. It's already ignored on a deployed site. On Firebase
Hosting the frontend reads its Firebase config from `/__/firebase/init.json`, so
there's no config file to add.
