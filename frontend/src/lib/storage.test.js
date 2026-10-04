import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  activeSteps,
  benefitsReminderNote,
  formatPlanDate,
  clearAnswers,
  clearSession,
  nextPage,
  ONBOARDING,
  readStep,
  ROUTES,
  saveStep,
  startUpdate,
  stepPosition,
} from './storage.js';

class MemoryStorage {
  constructor() { this.values = new Map(); }
  getItem(key) { return this.values.has(key) ? this.values.get(key) : null; }
  setItem(key, value) { this.values.set(key, String(value)); }
  removeItem(key) { this.values.delete(key); }
  clear() { this.values.clear(); }
}

beforeEach(() => {
  vi.stubGlobal('sessionStorage', new MemoryStorage());
  vi.stubGlobal('window', { dispatchEvent: vi.fn() });
});

describe('flow storage', () => {
  it('keeps account and company policy context when restarting care questions', () => {
    saveStep('user', 'person@example.com');
    saveStep('company', 'demo-company-2');
    saveStep('demo_employee_id', 'demo-c-lee');
    saveStep('procedure', 'filling');
    clearAnswers();
    expect(readStep('user')).toBe('person@example.com');
    expect(readStep('company')).toBe('demo-company-2');
    expect(readStep('demo_employee_id')).toBe('demo-c-lee');
    expect(readStep('procedure')).toBeNull();
  });
  it('stores JSON answers and restores them', () => {
    saveStep('location', { state: 'PA', zip: '19103' });
    expect(readStep('location')).toEqual({ state: 'PA', zip: '19103' });
    clearSession();
    expect(readStep('location')).toBeNull();
  });

  it('keeps the normal intake order', () => {
    expect(activeSteps().map((step) => step.key)).toEqual([
      'location', 'office', 'category', 'procedure', 'timing',
    ]);
    expect(nextPage('procedure')).toBe(ROUTES.chat);
    expect(stepPosition('category')).toEqual({ current: 3, total: 5 });
  });

  it('runs sign-up pages first, then hands location and office to the chat', () => {
    saveStep('onboarding', true);
    expect(activeSteps()).toEqual(ONBOARDING);
    expect(nextPage('name')).toBe(`${ROUTES.signup}?q=company`);
    expect(nextPage('company')).toBe(ROUTES.chat);

    clearSession();
    expect(startUpdate('manual', ROUTES.profile)).toMatch(/^\/history\?update=\d+$/);
    expect(activeSteps().map((step) => step.key)).toEqual(['procedures', 'location-check']);
    expect(readStep('update_return')).toBe(ROUTES.profile);
  });
});

describe('benefits reminder notice', () => {
  const benefits = {
    plan_year: { start: '2026-01-01', end: '2027-01-01' },
    annual_maximum: 7500, used: 250, remaining: 7250,
  };

  it('formats plan dates as calendar dates in any timezone', () => {
    const previous = process.env.TZ;
    process.env.TZ = 'America/New_York';
    try {
      expect(formatPlanDate('2027-01-01')).toBe('January 1, 2027');
    } finally {
      process.env.TZ = previous;
    }
    expect(formatPlanDate('not a date')).toBe('');
    expect(formatPlanDate(undefined)).toBe('');
  });

  it('states the backend-computed remaining amount and reset date', () => {
    expect(benefitsReminderNote(benefits)).toBe(
      'You still have $7,250.00 of your $7,500.00 annual dental benefit for this plan year. '
      + 'Unused benefits reset on January 1, 2027.');
  });

  it('shows nothing for missing data, nothing left, or unlimited plans', () => {
    expect(benefitsReminderNote(null)).toBeNull();
    expect(benefitsReminderNote({ ...benefits, remaining: 0 })).toBeNull();
    expect(benefitsReminderNote({ ...benefits, annual_maximum: 10000000, remaining: 10000000 })).toBeNull();
    expect(benefitsReminderNote({ ...benefits, annual_maximum: 'n/a' })).toBeNull();
  });
});
