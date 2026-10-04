// Firebase Authentication for every page. Loaded as an ES module after the
// classic scripts, it sets window.appAuth so they can sign in, sign out and get
// the ID token the backend checks (backend/auth.py). They only use it inside
// handlers, by which time this module has run.

import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js';
import {
  createUserWithEmailAndPassword,
  getAuth,
  signInWithEmailAndPassword,
  signOut,
} from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js';

async function loadConfig() {
  const configUrl = new URL('./firebaseConfig.json', import.meta.url);
  const response = await fetch(configUrl);
  if (!response.ok) throw new Error('Could not load the Firebase config (' + response.status + ')');
  return response.json();
}

// Resolves once Firebase knows whether someone is already signed in.
const ready = (async function () {
  const app = initializeApp(await loadConfig());
  const auth = getAuth(app);
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
