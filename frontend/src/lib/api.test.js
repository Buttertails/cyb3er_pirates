import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./auth.js', () => ({
  demoLoginActive: () => false,
  idToken: async () => 'signed-in-token',
}));

import { AppServiceError, fetchNearbyDentists, fetchProfile, fetchProcedures, requestEstimate, saveProcedures, sendLiveChat, sendStep, SignedOutError } from './api.js';
import { readStep, saveStep } from './storage.js';

beforeEach(() => {
  vi.stubGlobal('window', { crypto: { randomUUID: () => 'care-12345678' } });
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, status: 200, json: async () => ({
    procedures: [], estimate: { lines: [{ procedure_id: 'filling' }] },
  }) })));
});

describe('cloud-backed React API', () => {
  it('does not present browser profile data after a server failure', async () => {
    fetch.mockRejectedValueOnce(new Error('network down'));
    await expect(fetchProfile()).rejects.toThrow('unavailable');
  });

  it('keeps care reports scoped to the selected fictional employee', async () => {
    await fetchProcedures('demo-c-lee');
    expect(fetch.mock.calls[0][0]).toBe('/api/me/procedures?employee_id=demo-c-lee');
    await saveProcedures([{ procedure: 'filling', category: 'general', date: '2026-01', cost: 200,
      you_paid: 50, insurance_paid: 150 }], 'demo-c-lee');
    const [path, options] = fetch.mock.calls[1];
    expect(path).toBe('/api/me/procedures');
    expect(options.headers.Authorization).toBe('Bearer signed-in-token');
    expect(JSON.parse(options.body)).toMatchObject({ employee_id: 'demo-c-lee',
      procedures: [{ submission_id: 'care-12345678', insurance_paid: 150 }] });
  });

  it('uses the selected plan for estimates and Dialogflow chat', async () => {
    await requestEstimate('filling', { employeeId: 'demo-a-sam' });
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({
      employee_id: 'demo-a-sam', procedure_id: 'filling', network: 'in_network',
    });
    await sendLiveChat('demo-a-sam', null, { event: 'start' });
    expect(fetch.mock.calls[1][0]).toBe('/api/chat');
    expect(JSON.parse(fetch.mock.calls[1][1].body)).toEqual({ employee_id: 'demo-a-sam', event: 'start' });
  });

  it('requests nearby dentists with only the signed-in account context', async () => {
    fetch.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({
      status: 'ok', offices: [{ id: 'cary-c0' }], message: 'Sample offices',
    }) });
    const result = await fetchNearbyDentists();
    expect(result.offices).toEqual([{ id: 'cary-c0' }]);
    expect(fetch.mock.calls[0][0]).toBe('/api/me/dentists');
    expect(fetch.mock.calls[0][1]).toMatchObject({ method: 'GET',
      headers: { Authorization: 'Bearer signed-in-token' } });
    expect(fetch.mock.calls[0][1].body).toBeUndefined();
  });

  it('does not fabricate offices when directory request fails', async () => {
    fetch.mockResolvedValueOnce({ ok: false, status: 503 });
    await expect(fetchNearbyDentists()).rejects.toBeInstanceOf(AppServiceError);
    fetch.mockResolvedValueOnce({ ok: false, status: 401 });
    await expect(fetchNearbyDentists()).rejects.toBeInstanceOf(SignedOutError);
  });

  it('retains a saved office when a directory refresh still includes it', async () => {
    const values = new Map();
    vi.stubGlobal('sessionStorage', { getItem: (key) => values.get(key) || null,
      setItem: (key, value) => values.set(key, value), removeItem: (key) => values.delete(key) });
    window.dispatchEvent = vi.fn();
    saveStep('office', 'cary-c0');
    fetch.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({
      status: 'ok', message: 'Sample offices', offices: [{ id: 'cary-c0', name: 'Sample Cary Family Dental' }],
    }) });
    await sendStep('location', { state: 'NC', zip: '27519' });
    expect(readStep('office')).toBe('cary-c0');
  });

  it('keeps a saved office and returns a retry message if the directory is unavailable', async () => {
    const values = new Map();
    vi.stubGlobal('sessionStorage', { getItem: (key) => values.get(key) || null,
      setItem: (key, value) => values.set(key, value), removeItem: (key) => values.delete(key) });
    window.dispatchEvent = vi.fn();
    saveStep('office', 'cary-c0');
    fetch.mockResolvedValueOnce({ ok: false, status: 503 });
    await expect(sendStep('location', { state: 'NC', zip: '27519' })).resolves.toBeUndefined();
    expect(readStep('office')).toBe('cary-c0');
    expect(readStep('office_directory_message')).toMatch(/try again/i);
  });
});
