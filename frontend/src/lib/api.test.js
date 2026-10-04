import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./auth.js', () => ({
  demoLoginActive: () => false,
  idToken: async () => 'signed-in-token',
}));

import { fetchProfile, fetchProcedures, requestEstimate, saveProcedures, sendLiveChat } from './api.js';

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
});
