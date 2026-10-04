import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CATEGORIES, TIMEFRAMES } from '../../js/options.js';
import {
  firstStep,
  matchCare,
  matchChoice,
  nextIntakeStep,
  parseAmount,
  parseLocation,
  parseMonth,
  STEPS,
} from './chatScript.js';
import { readStep, saveStep, startUpdate, ROUTES } from './storage.js';

// The scripted onboarding still supports explicit local demo sign-in in tests.
vi.mock('./auth.js', () => ({ demoLoginActive: () => true, idToken: async () => 'token' }));

class MemoryStorage {
  constructor() { this.values = new Map(); }
  getItem(key) { return this.values.has(key) ? this.values.get(key) : null; }
  setItem(key, value) { this.values.set(key, String(value)); }
  removeItem(key) { this.values.delete(key); }
  clear() { this.values.clear(); }
}

beforeEach(() => {
  vi.stubGlobal('sessionStorage', new MemoryStorage());
  vi.stubGlobal('localStorage', new MemoryStorage());
  vi.stubGlobal('window', {
    dispatchEvent: vi.fn(),
    location: { hostname: 'localhost', protocol: 'http:' },
    crypto: { randomUUID: () => 'session-1' },
  });
  vi.spyOn(console, 'info').mockImplementation(() => {});
  saveStep('user', 'pat@example.com');
});

describe('matchChoice', () => {
  const choices = TIMEFRAMES.map(({ id, label }) => ({ id, label }));

  it('matches ids, labels and ordinals', () => {
    expect(matchChoice('two-weeks', choices).id).toBe('two-weeks');
    expect(matchChoice('As soon as possible', choices).id).toBe('asap');
    expect(matchChoice('2', choices).id).toBe('two-weeks');
    expect(matchChoice('the third one', choices).id).toBe('one-to-three-months');
  });

  it('matches aliases and unique words', () => {
    const withAliases = choices.map((choice) => (
      choice.id === 'not-sure' ? { ...choice, aliases: ['idk'] } : choice));
    expect(matchChoice('idk', withAliases).id).toBe('not-sure');
    expect(matchChoice('within 2 weeks please', choices).id).toBe('two-weeks');
  });

  it('returns null for unclear answers', () => {
    expect(matchChoice('banana', choices)).toBeNull();
    expect(matchChoice('', choices)).toBeNull();
  });
});

describe('matchCare', () => {
  it('reads a procedure name as its category and procedure', () => {
    expect(matchCare('I need a filling')).toEqual({
      category: CATEGORIES.find((item) => item.id === 'general'), procedure: 'filling',
    });
    expect(matchCare('root canal').procedure).toBe('root-canal');
  });

  it('falls back to the category when no single procedure fits', () => {
    expect(matchCare('cleaning').procedure).toBe('cleaning');
    const care = matchCare('just a checkup');
    expect(care.category.id).toBe('checkup');
    expect(care.procedure).toBeUndefined();
    expect(matchCare('my tooth hurts').category.id).toBe('emergency');
  });
});

describe('parseLocation', () => {
  it('reads state names, codes and ZIP codes', () => {
    expect(parseLocation('Ohio')).toEqual({ value: { state: 'OH', zip: '' } });
    expect(parseLocation('PA 19103')).toEqual({ value: { state: 'PA', zip: '19103' } });
    expect(parseLocation("I'm in West Virginia")).toEqual({ value: { state: 'WV', zip: '' } });
    expect(parseLocation('43215')).toEqual({ value: { state: 'OH', zip: '43215' } });
  });

  it('flags a ZIP code in another state and missing states', () => {
    expect(parseLocation('Ohio 19103').error).toMatch(/19103 is in Pennsylvania, not Ohio/);
    expect(parseLocation('somewhere').error).toMatch(/didn’t catch a state/);
    expect(parseLocation('PA 1910').error).toMatch(/5-digit/);
  });
});

describe('parseMonth and parseAmount', () => {
  const now = new Date(2026, 9, 3);

  it('reads months and rejects future ones', () => {
    expect(parseMonth('2026-03', now)).toEqual({ value: '2026-03' });
    expect(parseMonth('March 2025', now)).toEqual({ value: '2025-03' });
    expect(parseMonth('dec', now)).toEqual({ value: '2025-12' });
    expect(parseMonth('last month', now)).toEqual({ value: '2026-09' });
    expect(parseMonth('2026-11', now).error).toMatch(/already happened/);
    expect(parseMonth('whenever', now).error).toBeTruthy();
  });

  it('reads dollar amounts', () => {
    expect(parseAmount('$1,200.50')).toBe(1200.5);
    expect(parseAmount('')).toBeNull();
    expect(parseAmount('lots')).toBeNaN();
  });
});

describe('conversation flow', () => {
  it('starts at the first unanswered intake question', () => {
    expect(firstStep()).toBe('location');
    saveStep('location', { state: 'PA', zip: '' });
    saveStep('office', 'demo-office-1');
    expect(firstStep()).toBe('category');
  });

  it('starts the update questions after Update info', () => {
    saveStep('location', { state: 'PA', zip: '' });
    startUpdate('manual', ROUTES.profile);
    expect(firstStep()).toBe('procedures');
  });

  it('walks location, office and emergency care straight to the review', async () => {
    expect((await STEPS.location.answer({ text: 'Ohio 19103' })).error).toBeTruthy();
    expect(await STEPS.location.answer({ text: 'PA 19103' })).toEqual({ next: 'office' });
    expect(readStep('offices')).toHaveLength(3);

    expect(await STEPS.office.answer({ text: 'Parkview Smiles' })).toEqual({ next: 'category' });
    expect(readStep('office')).toBe('demo-office-2');

    const result = await STEPS.category.answer({ text: 'broken tooth' });
    expect(result.next).toBe('confirm');
    expect(result.replies.at(-1)).toMatch(/emergency care/);
    expect(readStep('timing')).toBe('asap');
    expect(nextIntakeStep()).toBe('confirm');
  });

  it('shows a few buttons but still accepts every typed answer', async () => {
    expect(STEPS.timing.suggestions().map((choice) => choice.id))
      .toEqual(['asap', 'two-weeks', 'one-to-three-months']);
    saveStep('category', 'general');
    expect(STEPS.procedure.suggestions()).toHaveLength(4);
    expect(await STEPS.timing.answer({ text: 'in 6 months' })).toEqual({ next: 'location' });
    expect(readStep('timing')).toBe('six-months-plus');
  });

  it('records recent dental work and checks the amounts add up', async () => {
    saveStep('demo_employee_id', 'demo-a-pat');
    saveStep('location', { state: 'PA', zip: '' });
    startUpdate('manual', ROUTES.profile);
    expect(await STEPS.procedures.answer({ choiceId: 'yes' })).toEqual({ next: 'work-procedure' });
    expect(await STEPS['work-procedure'].answer({ text: 'filling' })).toEqual({ next: 'work-date' });
    expect(await STEPS['work-date'].answer({ text: '2026-01' })).toEqual({ next: 'work-cost' });
    await STEPS['work-cost'].answer({ text: '100' });
    await STEPS['work-you-paid'].answer({ text: '80' });
    expect((await STEPS['work-insurance'].answer({ text: '50' })).next).toBe('work-cost');

    await STEPS['work-cost'].answer({ text: '200' });
    await STEPS['work-you-paid'].answer({ choiceId: 'skip' });
    expect(await STEPS['work-insurance'].answer({ text: '50' })).toEqual({ next: 'work-more' });
    expect((await STEPS['work-more'].answer({ text: 'that’s everything' })).next).toBe('location-check');
    expect(readStep('procedures_saved')).toBe(true);
  });
});
