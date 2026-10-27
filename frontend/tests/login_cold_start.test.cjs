const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { waitForBackendReadiness, sleep } = require('../lib/readiness');
const { createClient } = require('../lib/client');

test('waitForBackendReadiness: ready backend succeeds immediately on first attempt', async () => {
  const statusUpdates = [];
  let healthCalls = 0;

  const mockCheckHealth = async () => {
    healthCalls++;
    return { status: 'ok', simulation: true };
  };

  const result = await waitForBackendReadiness({
    checkHealth: mockCheckHealth,
    maxWaitMs: 5000,
    pollIntervalMs: 50,
    healthTimeoutMs: 100,
    waitNoticeDelayMs: 200,
    onStatusChange: (msg) => statusUpdates.push(msg)
  });

  assert.equal(result.ready, true);
  assert.equal(result.attempts, 1);
  assert.equal(healthCalls, 1);
  assert.deepEqual(statusUpdates, ['Connecting to ZettaRemit...']);
});

test('waitForBackendReadiness: sleeping backend retries and succeeds, updating status message', async () => {
  const statusUpdates = [];
  let healthCalls = 0;

  // Fails twice, then succeeds on attempt 3
  const mockCheckHealth = async () => {
    healthCalls++;
    if (healthCalls < 3) {
      throw new Error('Network error (Render spinning up)');
    }
    return { status: 'ok', simulation: true };
  };

  const result = await waitForBackendReadiness({
    checkHealth: mockCheckHealth,
    maxWaitMs: 5000,
    pollIntervalMs: 20,
    healthTimeoutMs: 50,
    waitNoticeDelayMs: 10,
    onStatusChange: (msg) => statusUpdates.push(msg)
  });

  assert.equal(result.ready, true);
  assert.equal(result.attempts, 3);
  assert.equal(healthCalls, 3);
  assert.ok(statusUpdates.includes('Connecting to ZettaRemit...'));
  assert.ok(statusUpdates.includes('Connecting to ZettaRemit... This may take a moment.'));
});

test('waitForBackendReadiness: times out after maxWaitMs and returns timedOut flag', async () => {
  const statusUpdates = [];
  let healthCalls = 0;

  const mockCheckHealth = async () => {
    healthCalls++;
    throw new Error('Backend completely unresponsive');
  };

  const result = await waitForBackendReadiness({
    checkHealth: mockCheckHealth,
    maxWaitMs: 120,
    pollIntervalMs: 20,
    healthTimeoutMs: 30,
    waitNoticeDelayMs: 10,
    onStatusChange: (msg) => statusUpdates.push(msg)
  });

  assert.equal(result.ready, false);
  assert.equal(result.timedOut, true);
  assert.ok(healthCalls >= 2);
  assert.ok(statusUpdates.includes('Connecting to ZettaRemit... This may take a moment.'));
});

test('waitForBackendReadiness: abort signal cancels in-flight polling immediately', async () => {
  const controller = new AbortController();
  const statusUpdates = [];
  let healthCalls = 0;

  const mockCheckHealth = async () => {
    healthCalls++;
    controller.abort(); // simulate screen unmount during first health check
    throw new Error('Aborted');
  };

  const result = await waitForBackendReadiness({
    checkHealth: mockCheckHealth,
    maxWaitMs: 5000,
    pollIntervalMs: 50,
    healthTimeoutMs: 100,
    onStatusChange: (msg) => statusUpdates.push(msg),
    signal: controller.signal
  });

  assert.equal(result.ready, false);
  assert.equal(result.aborted, true);
  assert.equal(healthCalls, 1);
});

test('client: health endpoint calls GET /health unauthenticated and supports signal cancellation', async () => {
  const calls = [];
  const responses = [{ status: 200, body: { status: 'ok', simulation: true } }];
  const fetchImpl = async (...args) => {
    calls.push(args);
    const r = responses.shift();
    return { ok: r.status < 400, status: r.status, json: async () => r.body };
  };
  const storage = { get: async () => null, set: async () => {}, clear: async () => {} };
  const client = createClient({ baseUrl: 'https://api.example.com', storage, fetchImpl });

  const health = await client.health();
  assert.equal(calls[0][0], 'https://api.example.com/health');
  assert.equal(calls[0][1].method, 'GET');
  assert.equal(calls[0][1].headers.Authorization, undefined);
  assert.equal(health.status, 'ok');

  // Test client request with abort signal
  const abortController = new AbortController();
  abortController.abort();
  await assert.rejects(
    () => client.health({ signal: abortController.signal }),
    (err) => err.code === 'ABORT' || err.name === 'AbortError'
  );
});

test('Login flow integration: sleeping backend waits for health, submits login once, and succeeds', async () => {
  const calls = [];
  let session = null;
  const storage = {
    get: async () => session,
    set: async (val) => { session = val; },
    clear: async () => { session = null; }
  };

  let healthAttempts = 0;
  let loginAttempts = 0;

  const fetchImpl = async (url, opts) => {
    calls.push({ url, opts });
    if (url.endsWith('/health')) {
      healthAttempts++;
      if (healthAttempts < 2) {
        throw new Error('Cold start delay');
      }
      return { ok: true, status: 200, json: async () => ({ status: 'ok', simulation: true }) };
    }
    if (url.endsWith('/users/login')) {
      loginAttempts++;
      return {
        ok: true,
        status: 200,
        json: async () => ({ access_token: 'auth-jwt-xyz', expires_in: 3600, full_name: 'Test User' })
      };
    }
    throw new Error('Unexpected URL: ' + url);
  };

  const client = createClient({ baseUrl: 'https://api.example.com', storage, fetchImpl });

  // Simulate LoginScreen flow
  const statusLog = [];
  const readiness = await waitForBackendReadiness({
    checkHealth: ({ timeoutMs, signal }) => client.health({ timeoutMs, signal }),
    maxWaitMs: 3000,
    pollIntervalMs: 20,
    healthTimeoutMs: 50,
    waitNoticeDelayMs: 10,
    onStatusChange: (msg) => statusLog.push(msg)
  });

  assert.equal(readiness.ready, true);
  assert.equal(healthAttempts, 2);

  // Submit login exactly once
  const loginRes = await client.login('test@example.com', 'ValidPassword123');
  assert.equal(loginAttempts, 1);
  assert.equal(loginRes.full_name, 'Test User');
  assert.equal(session.token, 'auth-jwt-xyz');
});

test('Login flow integration: invalid credentials show auth error immediately when backend is ready', async () => {
  let loginAttempts = 0;
  const storage = { get: async () => null, set: async () => {}, clear: async () => {} };

  const fetchImpl = async (url) => {
    if (url.endsWith('/health')) {
      return { ok: true, status: 200, json: async () => ({ status: 'ok' }) };
    }
    if (url.endsWith('/users/login')) {
      loginAttempts++;
      return {
        ok: false,
        status: 401,
        json: async () => ({ detail: 'Invalid credentials' })
      };
    }
    throw new Error('Unexpected URL');
  };

  const client = createClient({ baseUrl: 'https://api.example.com', storage, fetchImpl });

  const readiness = await waitForBackendReadiness({
    checkHealth: () => client.health(),
    maxWaitMs: 1000
  });
  assert.equal(readiness.ready, true);

  await assert.rejects(
    () => client.login('wrong@example.com', 'badpass'),
    (err) => err.message === 'Incorrect email or password. Please try again.' && err.status === 401
  );
  assert.equal(loginAttempts, 1);
});

test('Login flow integration: network failure during login throws sanitized network error', async () => {
  const storage = { get: async () => null, set: async () => {}, clear: async () => {} };

  const fetchImpl = async (url) => {
    if (url.endsWith('/health')) {
      return { ok: true, status: 200, json: async () => ({ status: 'ok' }) };
    }
    if (url.endsWith('/users/login')) {
      throw new Error('Connection reset by peer');
    }
    throw new Error('Unexpected URL');
  };

  const client = createClient({ baseUrl: 'https://api.example.com', storage, fetchImpl });

  const readiness = await waitForBackendReadiness({
    checkHealth: () => client.health(),
    maxWaitMs: 1000
  });
  assert.equal(readiness.ready, true);

  await assert.rejects(
    () => client.login('user@example.com', 'password123'),
    (err) => err.code === 'NETWORK' && err.message === 'Unable to connect. Please try again later.'
  );
});

test('LoginScreen source code adheres to contracts for cold start readiness, security, and UI', () => {
  const loginSrc = fs.readFileSync(path.join(__dirname, '../screens/LoginScreen.js'), 'utf8');
  const readinessSrc = fs.readFileSync(path.join(__dirname, '../lib/readiness.js'), 'utf8');

  // 1. Initial loading state and status messages across LoginScreen and readiness helper
  assert.match(loginSrc, /Connecting to ZettaRemit\.\.\./);
  assert.match(readinessSrc, /Connecting to ZettaRemit\.\.\. This may take a moment\./);

  // 2. Uses waitForBackendReadiness and api.health
  assert.match(loginSrc, /waitForBackendReadiness/);
  assert.match(loginSrc, /api\.health/);

  // 3. Exact timeout error message with retry
  assert.match(loginSrc, /ZettaRemit is taking longer than expected to connect\. Please try again\./);
  assert.match(loginSrc, /errorRetryButton/);

  // 4. Duplicate submission prevention
  assert.match(loginSrc, /if\s*\(\s*loading\s*\)\s*return/);
  assert.match(loginSrc, /disabled=\{loading\}/);

  // 5. Unmount cancellation
  assert.match(loginSrc, /isMountedRef/);
  assert.match(loginSrc, /abortControllerRef/);

  // 6. Security & credential hygiene: password reset, no logging of credentials
  assert.match(loginSrc, /setPassword\(''\)/);
  assert.doesNotMatch(loginSrc, /console\.log\(.*password.*\)/i);
  assert.doesNotMatch(loginSrc, /console\.log\(.*token.*\)/i);

  // 7. Preserves styling
  assert.match(loginSrc, /#001E62/);
  assert.match(loginSrc, /#0047AB/);
  assert.match(loginSrc, /desktopLeftPanel/);
});
