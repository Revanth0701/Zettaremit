const { test } = require('node:test');
const assert = require('node:assert/strict');
const { KEY, readNavigation, saveNavigation, isWebRefresh } = require('../lib/navigationState');
function storage() { const values = new Map(); return { getItem: key => values.get(key), setItem: (key, value) => values.set(key, value) }; }
test('refresh restores dashboard, transaction history, and assistant without persisting form data', () => {
  for (const route of [{ name: 'Dashboard', params: { page: 7, password: 'never-save' } }, { name: 'AIAssistant' }]) {
    const store = storage(); saveNavigation(store, { index: 0, routes: [route] });
    assert.doesNotMatch(store.getItem(KEY), /password|never-save/);
    assert.equal(readNavigation(store, true).name, route.name);
    assert.equal(readNavigation(store, false).name, 'Login');
  }
});
test('malformed state and unknown routes are ignored; incomplete transfers restart safely', () => {
  const store = storage(); store.setItem(KEY, '{');
  assert.equal(readNavigation(store, false).name, 'Welcome');
  store.setItem(KEY, JSON.stringify({ name: 'Unknown' }));
  assert.equal(readNavigation(store, true).name, 'Dashboard');
  saveNavigation(store, { routes: [{ name: 'Dashboard', params: { page: 5, quote_token: 'private' } }] });
  assert.deepEqual(readNavigation(store, true), { name: 'Dashboard', params: { page: 1 } });
  assert.doesNotMatch(store.getItem(KEY), /private/);
});

test('new visitors enter Welcome, returning users enter Dashboard, and only web reloads skip splash', () => {
  assert.equal(readNavigation(null, false).name, 'Welcome');
  assert.equal(readNavigation(null, true).name, 'Dashboard');
  const store = storage();
  saveNavigation(store, { routes: [{ name: 'Welcome' }] });
  assert.equal(readNavigation(store, true).name, 'Dashboard');
  for (const type of ['navigate', 'back_forward', 'reload']) {
    assert.equal(isWebRefresh({ getEntriesByType: () => [{ type }] }), type === 'reload');
  }
  assert.equal(isWebRefresh(null), false);
  assert.equal(isWebRefresh({ getEntriesByType: () => [] }), false);
  assert.equal(isWebRefresh({ getEntriesByType: () => { throw new Error('Unavailable'); } }), false);
});
