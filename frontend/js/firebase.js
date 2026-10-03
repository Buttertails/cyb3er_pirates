// Firebase Authentication for every page. Loaded as an ES module after the
// classic scripts, it sets window.appAuth so they can sign in, sign out and get
// the ID token the backend checks (backend/auth.py). They only use it inside
// handlers, by which time this module has run.
//
// On localhost the site talks to the Auth emulator started by
// `firebase emulators:start`, so no real accounts or config file are needed.
// Deployed on Firebase Hosting, the web config comes from the reserved
// /__/firebase/init.json URL.
import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js';
import {
  connectAuthEmulator,
  createUserWithEmailAndPassword,
  getAuth,
  signInWithEmailAndPassword,
  signOut,
} from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js';

// The projectId must match .firebaserc, or the backend rejects emulator tokens.
const EMULATOR_CONFIG = {
  apiKey: 'demo-api-key',
  authDomain: 'localhost',
  projectId: 'cyb3er-pirates-dental',
};
const AUTH_EMULATOR_URL = 'http://127.0.0.1:9099';

const isLocal = ['localhost', '127.0.0.1'].includes(window.location.hostname);

async function loadConfig() {
  if (isLocal) return EMULATOR_CONFIG;
  const response = await fetch('/__/firebase/init.json');
  if (!response.ok) throw new Error('Could not load the Firebase config (' + response.status + ')');
  return response.json();
}

// Resolves once Firebase knows whether someone is already signed in.
const ready = (async function () {
  const auth = getAuth(initializeApp(await loadConfig()));
  if (isLocal) connectAuthEmulator(auth, AUTH_EMULATOR_URL, { disableWarnings: true });
  await auth.authStateReady();
  return auth;
})();

window.appAuth = {
  async signIn(email, password) {
    const credential = await signInWithEmailAndPassword(await ready, email, password);
    return credential.user;
  },

  async signUp(email, password) {
    const credential = await createUserWithEmailAndPassword(await ready, email, password);
    return credential.user;
  },

  async signOut() {
    await signOut(await ready);
  },

  // The signed-in user's ID token for the backend, or null when nobody is signed in.
  async idToken() {
    const auth = await ready;
    return auth.currentUser ? auth.currentUser.getIdToken() : null;
  },
};
