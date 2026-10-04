import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

function browser(script, fetchImpl) {
  const context = vm.createContext({
    window: { appAuth: { idToken: async () => 'test-token' }, location: { hostname: 'example.com', protocol: 'https:' } },
    fetch: fetchImpl,
    AbortSignal,
    console,
    readStep: () => null,
    saveStep: () => {},
    demoLoginActive: () => false,
    localStorage: { getItem: () => { throw Error('local fallback used'); }, setItem: () => { throw Error('local fallback used'); } },
  });
  vm.runInContext(fs.readFileSync(new URL(script, import.meta.url), 'utf8'), context);
  return context;
}

test('profile save calls cloud API and reports an unavailable service', async () => {
  const calls = [];
  const ctx = browser('../js/api.js', async (path, opts) => {
    calls.push([path, opts.method]);
    throw Error('offline');
  });
  await assert.rejects(vm.runInContext("saveProfileDetails({name:'Pat'})", ctx));
  assert.deepEqual(calls, [['/api/me', 'PATCH']]);
});

test('estimate failure never returns a local financial result', async () => {
  const ctx = browser('../js/estimate.js', async () => { throw Error('offline'); });
  ctx.apiFetch = async () => { throw Error('offline'); };
  await assert.rejects(vm.runInContext(
    "requestEstimate('filling', {employeeId:'demo-a-pat'})", ctx
  ), /offline/);
});

test('conflicting care retry surfaces the server message', async () => {
  const ctx = browser('../js/api.js', async () => ({
    status: 409, ok: false, json: async () => ({ error: 'A different report already uses this submission ID.' }),
  }));
  await assert.rejects(
    vm.runInContext("saveProcedures([{submission_id:'care-123'}], 'demo-a-pat')", ctx),
    /different report/
  );
});

test('results page scripts load together without duplicate declarations', () => {
  const ctx = browser('../js/api.js', async () => ({}));
  assert.doesNotThrow(() => vm.runInContext(
    fs.readFileSync(new URL('../js/estimate.js', import.meta.url), 'utf8'), ctx
  ));
});

test('connected estimate sends the selected fictional employee', async () => {
  const sent = [];
  const ctx = browser('../js/api.js', async () => ({}));
  ctx.apiFetch = async (path, method, body) => {
    sent.push([path, method, body]);
    return { estimate: { lines: [{ plan_pays: 50 }] } };
  };
  vm.runInContext(fs.readFileSync(new URL('../js/estimate.js', import.meta.url), 'utf8'), ctx);
  const result = await vm.runInContext(
    "requestEstimate('root-canal', {employeeId:'demo-c-lee'})", ctx
  );
  assert.equal(result.lines[0].plan_pays, 50);
  assert.equal(sent[0][0], '/api/me/estimate');
  assert.equal(sent[0][2].employee_id, 'demo-c-lee');
});

test('older browser history remains explicitly unverified', () => {
  const ctx = browser('../js/api.js', async () => ({}));
  ctx.readStep = () => 'pat@example.com';
  ctx.localStorage.getItem = () => JSON.stringify({
    'pat@example.com': { procedures: [{ procedure: 'filling', date: '2026-09' }] },
  });
  const records = vm.runInContext('unverifiedLocalHistory()', ctx);
  assert.equal(records.length, 1);
  assert.equal(records[0].unverified_local, true);
});
