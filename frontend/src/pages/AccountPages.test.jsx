import { describe, expect, it } from 'vitest';
import { signInRouteDecision } from '../lib/accountNavigation.js';

describe('sign-in route navigation', () => {
  it('resumes a genuinely authenticated account instead of asking for a password', () => {
    expect(signInRouteDecision('pat@example.com', 'pat@example.com')).toBe('resume');
  });

  it('clears stale or mismatched browser account data', () => {
    expect(signInRouteDecision(null, 'pat@example.com')).toBe('clear');
    expect(signInRouteDecision('sam@example.com', 'pat@example.com')).toBe('hydrate');
  });
});
