import { ROUTES } from './storage.js';

export function signInRouteDecision(authEmail, savedEmail) {
  if (authEmail && authEmail === savedEmail) return 'resume';
  if (authEmail) return 'hydrate';
  return savedEmail ? 'clear' : 'signin';
}

// Reminder emails link to the sign-in page with ?reminder=<value>. Only these
// values are honored; the parameter never carries a path or identity.
const REMINDER_LANDINGS = { benefits: ROUTES.profile };

export function reminderFromSearch(search) {
  const value = new URLSearchParams(search || '').get('reminder');
  return value && Object.hasOwn(REMINDER_LANDINGS, value) ? value : null;
}

export function signedInDestination(reminder) {
  return reminder && Object.hasOwn(REMINDER_LANDINGS, reminder) ? REMINDER_LANDINGS[reminder] : ROUTES.chat;
}

// Onboarding comes first, then the stale-sign-in update (which records the
// sign-in when it finishes and returns to the destination), then the destination.
export function postSignInPlan({ onboardingPage, stale, reminder }) {
  if (onboardingPage) return { kind: 'onboarding', page: onboardingPage, recordNow: true };
  const destination = signedInDestination(reminder);
  if (stale) return { kind: 'stale', returnTo: destination, recordNow: false };
  return { kind: 'destination', page: destination, recordNow: true };
}
