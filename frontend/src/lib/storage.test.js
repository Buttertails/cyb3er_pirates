import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  activeSteps,
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
    expect(startUpdate('manual', ROUTES.profile)).toMatch(/^\/chat\?update=\d+$/);
    expect(activeSteps().map((step) => step.key)).toEqual(['procedures', 'location-check']);
    expect(readStep('update_return')).toBe(ROUTES.profile);
  });
});
