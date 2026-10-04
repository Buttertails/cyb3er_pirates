import { describe, expect, it } from 'vitest';
import {
  postSignInPlan,
  reminderFromSearch,
  signedInDestination,
  signInRouteDecision,
} from '../lib/accountNavigation.js';
import { ROUTES } from '../lib/storage.js';

describe('sign-in route navigation', () => {
  it('resumes a genuinely authenticated account instead of asking for a password', () => {
    expect(signInRouteDecision('pat@example.com', 'pat@example.com')).toBe('resume');
  });

  it('clears stale or mismatched browser account data', () => {
    expect(signInRouteDecision(null, 'pat@example.com')).toBe('clear');
    expect(signInRouteDecision('sam@example.com', 'pat@example.com')).toBe('hydrate');
  });
});

describe('reminder email landing', () => {
  it('accepts only allowlisted reminder values', () => {
    expect(reminderFromSearch('?reminder=benefits')).toBe('benefits');
    expect(reminderFromSearch('?lang=en&reminder=benefits')).toBe('benefits');
    for (const search of ['', '?reminder=', '?reminder=Benefits', '?reminder=__proto__',
      '?reminder=toString', '?reminder=https://evil.example', '?next=/profile.html']) {
      expect(reminderFromSearch(search)).toBeNull();
    }
  });

  it('lands benefits reminders on the profile and everything else on chat', () => {
    expect(signedInDestination('benefits')).toBe(ROUTES.profile);
    expect(signedInDestination(null)).toBe(ROUTES.chat);
    expect(signedInDestination('constructor')).toBe(ROUTES.chat);
  });

  it('puts onboarding first, then the stale update, then the destination', () => {
    expect(postSignInPlan({ onboardingPage: '/signup.html?q=name', stale: true, reminder: 'benefits' }))
      .toEqual({ kind: 'onboarding', page: '/signup.html?q=name', recordNow: true });
    expect(postSignInPlan({ onboardingPage: null, stale: true, reminder: 'benefits' }))
      .toEqual({ kind: 'stale', returnTo: ROUTES.profile, recordNow: false });
    expect(postSignInPlan({ onboardingPage: null, stale: true, reminder: null }))
      .toEqual({ kind: 'stale', returnTo: ROUTES.chat, recordNow: false });
    expect(postSignInPlan({ onboardingPage: null, stale: false, reminder: 'benefits' }))
      .toEqual({ kind: 'destination', page: ROUTES.profile, recordNow: true });
  });
});
