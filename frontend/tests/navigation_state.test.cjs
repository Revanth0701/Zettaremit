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

test('native/default visitors enter Welcome, returning users enter Dashboard, and only web reloads skip splash', () => {
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

test('unauthenticated web visitors default to Home when saved navigation is absent or unusable', () => {
  assert.deepEqual(readNavigation(null, false, 'web'), { name: 'Home' });
  for (const value of ['{', 'null', JSON.stringify({ name: 'Unknown' })]) {
    const store = storage(); store.setItem(KEY, value);
    assert.deepEqual(readNavigation(store, false, 'web'), { name: 'Home' });
  }
  assert.deepEqual(readNavigation({ getItem() { throw new Error('Storage unavailable'); } }, false, 'web'), { name: 'Home' });
});

test('web landing default preserves saved routes and authenticated route guards', () => {
  for (const name of ['Home', 'Welcome', 'Login', 'HowItWorks', 'RatesAndFees', 'About']) {
    const store = storage(); saveNavigation(store, { routes: [{ name }] });
    assert.deepEqual(readNavigation(store, false, 'web'), { name });
  }
  assert.deepEqual(readNavigation(null, true, 'web'), { name: 'Dashboard' });
  for (const name of ['Welcome', 'Login', 'Dashboard', 'AIAssistant']) {
    const store = storage(); saveNavigation(store, { routes: [{ name }] });
    const authenticated = ['Welcome', 'Login'].includes(name) ? 'Dashboard' : name;
    assert.equal(readNavigation(store, true, 'web').name, authenticated);
    if (['Dashboard', 'AIAssistant'].includes(name)) assert.deepEqual(readNavigation(store, false, 'web'), { name: 'Login' });
  }
});

test('explicit native platforms retain their Welcome landing and authenticated Dashboard default', () => {
  for (const platform of ['ios', 'android']) {
    assert.deepEqual(readNavigation(null, false, platform), { name: 'Welcome' });
    assert.deepEqual(readNavigation(null, true, platform), { name: 'Dashboard' });
  }
});
