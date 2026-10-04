import test from 'node:test';
import assert from 'node:assert/strict';

const moduleUrl = 'https://example.test/js/firebase.js';
const response = (status, config) => ({ status, ok: status === 200, json: async () => config });
const loader = async () => (await import('../js/firebase-config.mjs')).loadFirebaseConfig;

test('preserves the explicit team configuration when present', async () => {
  const load = await loader();
  const config = { projectId: 'team-project', apiKey: 'dummy-public-web-key' };
  const actual = await load(async url => {
    assert.equal(String(url), 'https://example.test/js/firebaseConfig.json');
    return response(200, config);
  }, moduleUrl);
  assert.deepEqual(actual, config);
});

test('a missing ignored file uses the existing Hosting project config', async () => {
  const load = await loader();
  const config = { projectId: 'cyb3r-pirates', apiKey: 'dummy-public-web-key' };
  const actual = await load(async url => {
    if (String(url) === 'https://example.test/js/firebaseConfig.json') return response(404);
    assert.equal(String(url), 'https://example.test/__/firebase/init.json');
    return response(200, config);
  }, moduleUrl);
  assert.deepEqual(actual, config);
});

test('Hosting SPA rewrite returning HTML for the absent config falls back to Hosting config', async () => {
  const load = await loader();
  const config = { projectId: 'cyb3r-pirates', apiKey: 'dummy-public-web-key' };
  const actual = await load(async url => {
    if (String(url).endsWith('/firebaseConfig.json')) {
      return { status: 200, ok: true, json: async () => { throw new SyntaxError('Unexpected token <'); } };
    }
    assert.equal(String(url), 'https://example.test/__/firebase/init.json');
    return response(200, config);
  }, moduleUrl);
  assert.deepEqual(actual, config);
});

test('does not hide an error fetching the explicit team config', async () => {
  const load = await loader();
  await assert.rejects(load(async url => {
    assert.equal(String(url), 'https://example.test/js/firebaseConfig.json');
    return response(500);
  }, moduleUrl), /500/);
});

test('missing both config sources reports the setup problem', async () => {
  const load = await loader();
  await assert.rejects(load(async () => response(404), moduleUrl), /Firebase config/);
});
