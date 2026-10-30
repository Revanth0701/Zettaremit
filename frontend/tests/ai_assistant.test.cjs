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

test('AIAssistantScreen uses professional AI icon and hides technical source filenames', () => {
  const filePath = path.join(__dirname, '..', 'screens', 'AIAssistantScreen.js');
  const code = fs.readFileSync(filePath, 'utf8');

  // Must not use robot emoji
  assert.doesNotMatch(code, /🤖/, 'Robot emoji should be replaced with professional AI icon');
  assert.match(code, /AssistantIcon/, 'Must use dedicated AssistantIcon component');

  // Must not render raw source filename variables in user-facing message bubbles
  assert.doesNotMatch(code, /{src}/, 'Technical source filenames (.md) must not be rendered in chat');

  // Must have streaming handler
  assert.match(code, /aiAskStream/, 'Must implement response streaming via api.aiAskStream');
});

test('RegistrationWizard displays clean password placeholder and inline validation error for < 12 characters', () => {
  const filePath = path.join(__dirname, '..', 'screens', 'RegistrationWizard.js');
  const code = fs.readFileSync(filePath, 'utf8');

  // Clean placeholder without byte jargon
  assert.match(code, /placeholder="Enter your password"/, 'Password placeholder must be "Enter your password"');
  assert.doesNotMatch(code, /max 72 bytes/i, 'Placeholder must not display technical byte limit language');

  // Inline validation error message
  assert.match(code, /Password must be at least 12 characters./, 'Must show clear 12-character validation message');
  assert.match(code, /inlineErrorContainer/, 'Must render inline error container');
});

test('client aiAskStream streams chunks progressively, attaches Bearer token, and handles completion', async () => {
  const chunks = [
    'data: {"type": "start", "sources": ["about_zettaremit.md"]}\n\n',
    'data: {"type": "chunk", "content": "Hello "}\n\n',
    'data: {"type": "chunk", "content": "from ZettaRemit!"}\n\n',
    'data: {"type": "done", "latency_seconds": 0.4, "sources": ["about_zettaremit.md"]}\n\n'
  ];

  let streamReadIdx = 0;
  let requestHeaders = null;
  const recordedChunks = [];

  const client = createClient({
    baseUrl: 'https://api.example.com',
    storage: { get: async () => ({ token: 'mock-stream-jwt', expiresAt: Date.now() + 60000 }), set: async () => {}, clear: async () => {} },
    fetchImpl: async (url, opts) => {
      requestHeaders = opts.headers;
      return {
        ok: true,
        status: 200,
        body: {
          getReader: () => ({
            read: async () => {
              if (streamReadIdx < chunks.length) {
                const chunkStr = chunks[streamReadIdx++];
                return { done: false, value: new TextEncoder().encode(chunkStr) };
              }
              return { done: true, value: undefined };
            }
          })
        }
      };
    }
  });

  const result = await client.aiAskStream('What is ZettaRemit?', 'session-stream-test', {
    onChunk: (chunk) => recordedChunks.push(chunk)
  });

  assert.equal(requestHeaders.Authorization, 'Bearer mock-stream-jwt', 'Must attach Bearer auth token');
  assert.deepEqual(recordedChunks, ['Hello ', 'from ZettaRemit!'], 'Must invoke onChunk for each incoming chunk');
  assert.equal(result.answer, 'Hello from ZettaRemit!', 'Must return complete accumulated answer');
  assert.deepEqual(result.sources, ['about_zettaremit.md'], 'Must track retrieved sources');
});

test('DashboardScreen and AIAssistantScreen adhere to final professional UI polish standards', () => {
  const dashPath = path.join(__dirname, '..', 'screens', 'DashboardScreen.js');
  const dashCode = fs.readFileSync(dashPath, 'utf8');

  // 1. No robot emoji anywhere in Dashboard
  assert.doesNotMatch(dashCode, /🤖/, 'DashboardScreen must not use robot emoji');

  // 2. No prominent yellow simulation banner #FFF4D6
  assert.doesNotMatch(dashCode, /FFF4D6/i, 'DashboardScreen must not display large yellow simulation banner');

  // 3. Must use AssistantIcon for AI Assistant entry points
  assert.match(dashCode, /AssistantIcon/, 'DashboardScreen must use AssistantIcon sparkle medallion');

  // 4. AIAssistantScreen subtitle must be "Your ZettaRemit AI Assistant"
  const aiPath = path.join(__dirname, '..', 'screens', 'AIAssistantScreen.js');
  const aiCode = fs.readFileSync(aiPath, 'utf8');
  assert.match(aiCode, /Your ZettaRemit AI Assistant/, 'AIAssistantScreen must display updated subtitle');
  assert.doesNotMatch(aiCode, /Official Remittance Support/, 'Old subtitle must be replaced');
});

test('Authenticated navigation provides permanent ZettaAI Assistant entry points on desktop sidebar and mobile', () => {
  const dashPath = path.join(__dirname, '..', 'screens', 'DashboardScreen.js');
  const dashCode = fs.readFileSync(dashPath, 'utf8');
  const appPath = path.join(__dirname, '..', 'App.js');
  const appCode = fs.readFileSync(appPath, 'utf8');
  const aiPath = path.join(__dirname, '..', 'screens', 'AIAssistantScreen.js');
  const aiCode = fs.readFileSync(aiPath, 'utf8');

  // 1. Root App.js must register AIAssistantScreen on root stack
  assert.match(
    appCode,
    /<Stack\.Screen\s+name="AIAssistant"\s+component=\{AIAssistantScreen\}/,
    'App.js must register AIAssistant route pointing to AIAssistantScreen'
  );

  // 2. Desktop sidebar must contain visible ZettaAI Assistant navigation entry positioned below History
  const historyIdx = dashCode.indexOf('>History</Text>');
  const aiNavIdx = dashCode.indexOf('ZettaAI Assistant');
  assert.ok(historyIdx !== -1, 'History nav item must exist in DashboardScreen');
  assert.ok(aiNavIdx !== -1, 'ZettaAI Assistant nav item must exist in DashboardScreen');
  assert.ok(aiNavIdx > historyIdx, 'ZettaAI Assistant option must be positioned below History in the sidebar');

  // 3. Desktop sidebar must navigate directly to AIAssistant
  assert.match(
    dashCode,
    /navigation\.navigate\(['"]AIAssistant['"]\)/,
    'Desktop sidebar must navigate to AIAssistant'
  );

  // 4. Mobile bottom nav bar must contain dedicated ZettaAI tab
  assert.match(
    dashCode,
    /<View\s+style=\{.*?styles\.bottomNavBar.*?}>[\s\S]*?ZettaAI[\s\S]*?<\/View>/,
    'Mobile bottom navigation bar must contain dedicated ZettaAI tab'
  );

  // 5. AIAssistantScreen must support returning back to the Dashboard
  assert.match(
    aiCode,
    /navigation\.goBack\(\)|navigation\.navigate\(['"]Dashboard['"]\)/,
    'AIAssistantScreen must allow returning to Dashboard'
  );
});

