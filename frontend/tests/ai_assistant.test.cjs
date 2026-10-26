const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createClient } = require('../lib/client');

test('AIAssistantScreen source code adheres to security and UI contracts', () => {
  const filePath = path.join(__dirname, '..', 'screens', 'AIAssistantScreen.js');
  assert.ok(fs.existsSync(filePath), 'AIAssistantScreen.js must exist');
  const code = fs.readFileSync(filePath, 'utf8');

  // 1. Simulation-only disclaimer banner
  assert.match(
    code,
    /SIMULATION ONLY.*?ZettaRemit is an educational software simulation and does not move real money/s,
    'Must include the simulation-only disclaimer'
  );

  // 2. Clear welcome message
  assert.match(
    code,
    /I am the ZettaRemit AI Assistant/i,
    'Must include welcome message explaining the assistant capabilities'
  );

  // 3. Clear Chat button
  assert.match(
    code,
    /Clear Chat/i,
    'Must include Clear Chat action button'
  );

  // 4. In-memory UUIDv4 session management
  assert.match(
    code,
    /Crypto\.randomUUID\(\)/,
    'Must generate random UUIDv4 in memory for session continuity'
  );
  assert.doesNotMatch(
    code,
    /SecureStore\.setItem|sessionStorage\.setItem/i,
    'Session ID must never be persisted to long-term storage or leak across users'
  );

  // 5. Source pill citations
  assert.match(
    code,
    /sourcesContainer|sourcePill/i,
    'Must display source citation pills for retrieved knowledge chunks'
  );

  // 6. Elapsed timer and loading state for local CPU inference
  assert.match(
    code,
    /loadingSeconds|ActivityIndicator/i,
    'Must display loading indicator with elapsed inference timer'
  );

  // 7. Error handling for 429, 503, 504
  assert.match(code, /429/, 'Must handle 429 concurrency errors');
  assert.match(code, /503/, 'Must handle 503 service unavailable errors');
  assert.match(code, /504/, 'Must handle 504 timeout errors');
});

test('WelcomeScreen restricts AI access, while DashboardScreen shows AI button only to authenticated users when healthy', () => {
  const welcomePath = path.join(__dirname, '..', 'screens', 'WelcomeScreen.js');
  const welcomeCode = fs.readFileSync(welcomePath, 'utf8');

  // WelcomeScreen must NOT show AI assistant to unauthenticated visitors
  assert.doesNotMatch(
    welcomeCode,
    /api\.aiHealth|AIAssistant/,
    'WelcomeScreen must not expose AI assistant to unauthenticated visitors'
  );

  const dashPath = path.join(__dirname, '..', 'screens', 'DashboardScreen.js');
  const dashCode = fs.readFileSync(dashPath, 'utf8');

  assert.match(
    dashCode,
    /api\.aiHealth/,
    'DashboardScreen must verify AI health before displaying entry button'
  );
  assert.match(
    dashCode,
    /aiEnabled\s*&&\s*\(\s*<TouchableOpacity/s,
    'DashboardScreen must conditionally render AI action card only when aiEnabled is true'
  );
});

test('client aiAsk sends 120s timeout, propagates detailed AI error messages, and attaches Bearer token', async () => {
  const responses = [
    { status: 429, body: { detail: 'Assistant is busy with another query' } },
    { status: 504, body: { detail: 'Inference request timed out' } },
    { status: 422, body: { detail: 'Question cannot be empty' } },
    { status: 200, body: { question: 'q', answer: 'a', sources: ['about_zettaremit.md'], latency_seconds: 1.5 } }
  ];

  let reqIndex = 0;
  const recordedCalls = [];
  const client = createClient({
    baseUrl: 'https://api.example.com',
    storage: { get: async () => ({ token: 'mock-auth-jwt', expiresAt: Date.now() + 60000 }), set: async () => {}, clear: async () => {} },
    fetchImpl: async (url, opts) => {
      recordedCalls.push({ url, opts });
      const current = responses[reqIndex++];
      return {
        ok: current.status >= 200 && current.status < 300,
        status: current.status,
        json: async () => current.body
      };
    }
  });

  // 1. 429
  await assert.rejects(
    () => client.aiAsk('test', 'session-1234567890abcdef'),
    err => err.status === 429 && err.message === 'Assistant is busy with another query'
  );

  // 2. 504
  await assert.rejects(
    () => client.aiAsk('test', 'session-1234567890abcdef'),
    err => err.status === 504 && err.message === 'Inference request timed out'
  );

  // 3. 422
  await assert.rejects(
    () => client.aiAsk('test', 'session-1234567890abcdef'),
    err => err.status === 422 && err.message === 'Question cannot be empty'
  );

  // 4. 200 Success
  const result = await client.aiAsk('test', 'session-1234567890abcdef');
  assert.equal(result.answer, 'a');
  assert.deepEqual(result.sources, ['about_zettaremit.md']);
  assert.equal(recordedCalls[3].opts.headers.Authorization, 'Bearer mock-auth-jwt', 'Must attach Bearer auth token');
});
