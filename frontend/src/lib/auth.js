import { initializeApp } from 'firebase/app';
import {
  createUserWithEmailAndPassword,
  getAuth,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
} from 'firebase/auth';
import { loadFirebaseConfig } from '../../js/firebase-config.mjs';
import { clearSession, DEMO_LOGIN } from './storage.js';

let authPromise;

function authReady() {
  if (!authPromise) {
    authPromise = (async () => {
      const app = initializeApp(await loadFirebaseConfig());
      const auth = getAuth(app);
      await auth.authStateReady();
      return auth;
    })();
  }
  return authPromise;
}

export function demoLoginActive() {
  const host = window.location.hostname;
  return DEMO_LOGIN && (window.location.protocol === 'file:' ||
    host === 'localhost' || host === '127.0.0.1');
}

export async function signIn(email, password) {
  if (demoLoginActive()) return { email };
  const credential = await signInWithEmailAndPassword(await authReady(), email, password);
  return credential.user;
}

export async function signUp(email, password) {
  if (demoLoginActive()) return { email };
  const credential = await createUserWithEmailAndPassword(await authReady(), email, password);
  return credential.user;
}

export async function signOut() {
  try {
    if (!demoLoginActive()) await firebaseSignOut(await authReady());
  } finally {
    clearSession();
  }
}

export async function idToken() {
  if (demoLoginActive()) return 'demo-token';
  const auth = await authReady();
  return auth.currentUser ? auth.currentUser.getIdToken() : null;
}

export function authMessage(error, fallback) {
  switch (error?.code) {
    case 'auth/invalid-credential':
    case 'auth/invalid-login-credentials':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return "That email and password don't match an account.";
    case 'auth/invalid-email': return 'Enter a valid email address.';
    case 'auth/email-already-in-use': return 'An account with that email already exists. Sign in instead.';
    case 'auth/weak-password': return 'Choose a password with at least 6 characters.';
    case 'auth/operation-not-allowed': return "Email and password sign-in isn't enabled for this Firebase project.";
    case 'auth/too-many-requests': return 'Too many attempts. Wait a moment, then try again.';
    case 'auth/network-request-failed': return "We couldn't reach the sign-in service. Check your connection and try again.";
    default: return fallback;
  }
}
