const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { triggerBackgroundWakeup, markBackendAwake } = require('../lib/readiness');
const { createClient } = require('../lib/client');

const readSrc = (relPath) => fs.readFileSync(path.join(__dirname, '..', relPath), 'utf8');

test('Public Website: uses official logo.png asset exclusively and preserves navy branding', () => {
  const homeSrc = readSrc('screens/HomeScreen.js');
  const howSrc = readSrc('screens/HowItWorksScreen.js');
  const ratesSrc = readSrc('screens/RatesAndFeesScreen.js');
  const aboutSrc = readSrc('screens/AboutScreen.js');

  for (const [name, src] of Object.entries({ HomeScreen: homeSrc, HowItWorksScreen: howSrc, RatesAndFeesScreen: ratesSrc, AboutScreen: aboutSrc })) {
    assert.match(src, /require\(['"]\.\.\/assets\/logo\.png['"]\)/, `${name} must use official logo.png`);
    assert.doesNotMatch(src, /stylized.*z/i, `${name} must not use a stylized Z`);
    assert.match(src, /#001E62|#00164D|#071633/, `${name} must preserve premium navy-blue visual identity`);
  }
});

test('Public Website: displays "Get Started" as primary CTA and does NOT display a Log In button on public pages', () => {
  const homeSrc = readSrc('screens/HomeScreen.js');
  const howSrc = readSrc('screens/HowItWorksScreen.js');
  const ratesSrc = readSrc('screens/RatesAndFeesScreen.js');
  const aboutSrc = readSrc('screens/AboutScreen.js');

  for (const [name, src] of Object.entries({ HomeScreen: homeSrc, HowItWorksScreen: howSrc, RatesAndFeesScreen: ratesSrc, AboutScreen: aboutSrc })) {
    // Primary CTA present
    assert.match(src, /Get Started/, `${name} must display "Get Started"`);

    // Must NOT have a "Log In" button or login navigation in the public header / public content
    assert.doesNotMatch(src, /<Text[^>]*>(?:Log In|Login)<\/Text>/, `${name} must NOT display a Log In button`);
    assert.doesNotMatch(src, /navigation\.navigate\(['"]Login['"]\)/, `${name} must NOT navigate directly to Login from public pages`);

    // Get Started navigates to Welcome (where users choose Login or Signup)
    assert.match(src, /navigation\.navigate\(['"]Welcome['"]\)/, `${name} "Get Started" must navigate to Welcome`);
  }
});

test('Public Website: How It Works details all four required simulation steps', () => {
  const howSrc = readSrc('components/HowItWorksSection.js');
  assert.match(howSrc, /Create Your Account/);
  assert.match(howSrc, /Enter Transfer Details/);
  assert.match(howSrc, /Review Simulated Quote/);
  assert.match(howSrc, /Track Your Transaction/);
  assert.match(howSrc, /Transparent 3% Fee/);
});

test('Public Website: Rates & Fees explains reference rates and 3% simulation fee without hardcoded 86.50', () => {
  const ratesSrc = readSrc('components/RatesAndFeesSection.js');
  assert.match(ratesSrc, /Reference Exchange Rates/);
  assert.match(ratesSrc, /Flat 3\.00% Simulation Fee/);
  assert.match(ratesSrc, /Fee \(INR\) = Gross Amount × 0\.03/);
  assert.match(ratesSrc, /Illustrative Transfer Examples/);
  // Must NOT contain hardcoded 86.50
  assert.doesNotMatch(ratesSrc, /86\.50/);
});

test('Public Website: About ZettaRemit includes mission and mandatory simulation disclosure', () => {
  const aboutSrc = readSrc('components/AboutSection.js');
  assert.match(aboutSrc, /Demystifying Cross-Border Transfers/);
  assert.match(aboutSrc, /Mandatory Simulation Disclosure/);
  assert.match(aboutSrc, /ZettaRemit is an educational remittance simulation platform/);
  assert.match(aboutSrc, /does not process real monetary transactions/);
});

test('Public Website: ZettaAI preview provides informational demo without exposing authenticated endpoints or hardcoded rate', () => {
  const aiPreviewSrc = readSrc('components/ZettaAIPreview.js');
  assert.match(aiPreviewSrc, /ZETTA AI ASSISTANT PREVIEW/);
  assert.match(aiPreviewSrc, /Sign in for Live Interactive AI Chat/);
  assert.match(aiPreviewSrc, /Get Started with ZettaAI/);
  assert.doesNotMatch(aiPreviewSrc, /86\.50/);
  assert.doesNotMatch(aiPreviewSrc, /api\.aiAsk/);
  assert.doesNotMatch(aiPreviewSrc, /api\.aiAskStream/);
  assert.doesNotMatch(aiPreviewSrc, /Authorization/);
});

test('Public Website: Render Free backend wake-up triggers once non-blockingly and deduplicates concurrent attempts', async () => {
  let healthChecks = 0;
  const mockHealth = async () => {
    healthChecks++;
    return { status: 'ok', simulation: true };
  };

  markBackendAwake(false);

  // Trigger two concurrent wakeup calls
  const [res1, res2] = await Promise.all([
    triggerBackgroundWakeup({ checkHealth: mockHealth, timeoutMs: 100 }),
    triggerBackgroundWakeup({ checkHealth: mockHealth, timeoutMs: 100 }),
  ]);

  assert.equal(res1.ready, true);
  assert.equal(res2.ready, true);
  assert.equal(healthChecks, 1, 'Only one non-blocking health check should run for concurrent calls');

  const homeSrc = readSrc('screens/HomeScreen.js');
  assert.match(homeSrc, /api\.wakeBackend\(\)/);
});

test('Public Website: mobile responsive drawer and layout adapt correctly', () => {
  const homeSrc = readSrc('screens/HomeScreen.js');
  assert.match(homeSrc, /useWindowDimensions/);
  assert.match(homeSrc, /isDesktop/);
  assert.match(homeSrc, /hamburgerButton/);
  assert.match(homeSrc, /mobileDrawer/);
  assert.match(homeSrc, /modalOverlay/);
  assert.match(homeSrc, /CorridorIllustration/);
  assert.match(homeSrc, /TransferCalculatorPreview/);
});

// =========================================================================
// EXCHANGE RATE REGRESSION TESTS (Hardcoded 86.50 Removal & Dynamic Rates)
// =========================================================================

test('TransferCalculatorPreview: eliminates hardcoded 86.50 fallback and handles loading and unavailable states', () => {
  const calcSrc = readSrc('components/TransferCalculatorPreview.js');

  // 1. Must NOT contain hardcoded fallback 86.50
  assert.doesNotMatch(calcSrc, /86\.50/, 'Must not contain 86.50');
  assert.doesNotMatch(calcSrc, /DEFAULT_FALLBACK_RATE/, 'Must not define hardcoded fallback constant');

  // 2. Exact loading notice while backend is sleeping or rate is loading
  assert.match(calcSrc, /Fetching reference exchange rate\.\.\./);

  // 3. Exact unavailable notice when rate cannot be retrieved
  assert.match(calcSrc, /Reference rate temporarily unavailable/);

  // 4. Must NOT display an invented USD payout when unavailable (uses placeholder dash)
  assert.match(calcSrc, /USD conversion unavailable without a verified exchange rate\./);

  // 5. Preserves 3% fee calculation
  assert.match(calcSrc, /FEE_PERCENT = 3/);
});

test('client.getReferenceRate: successful retrieval returns verified rate, timestamp, and attribution', async () => {
  const calls = [];
  const fetchImpl = async (url, opts) => {
    calls.push({ url, opts });
    if (url.endsWith('/simulation/config')) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          inr_per_usd: '95.25000000',
          observed_at: '2026-10-27T00:00:00Z',
          attribution_text: 'Rates By Exchange Rate API',
          source_currency: 'INR',
          target_currency: 'USD',
          fee_percent: '3',
          simulation: true
        })
      };
    }
    throw new Error('Unexpected URL: ' + url);
  };

  const storage = { get: async () => null, set: async () => {}, clear: async () => {} };
  const client = createClient({ baseUrl: 'https://api.example.com', storage, fetchImpl });

  const result = await client.getReferenceRate();
  assert.equal(result.rate, 95.25);
  assert.equal(result.inr_per_usd, '95.25000000');
  assert.equal(result.attribution_text, 'Rates By Exchange Rate API');
  assert.equal(result.observed_at, '2026-10-27T00:00:00Z');
  assert.equal(calls[0].url, 'https://api.example.com/simulation/config');
  assert.equal(calls[0].opts.headers.Authorization, undefined, 'Must not send Authorization header for public unauthenticated request');
});

test('client.getReferenceRate: handles backend cold start / network delay safely without crashing', async () => {
  const fetchImpl = async () => {
    const error = new Error('Render sleeping (cold start connection timeout)');
    error.name = 'AbortError';
    throw error;
  };

  const storage = { get: async () => null, set: async () => {}, clear: async () => {} };
  const client = createClient({ baseUrl: 'https://api.example.com', storage, fetchImpl });

  await assert.rejects(
    () => client.getReferenceRate({ timeoutMs: 50 }),
    (err) => err.code === 'TIMEOUT' || err.message.includes('unavailable') || err.message.includes('timed out')
  );
});

test('client.getReferenceRate: handles HTTP 503 unavailable rate without inventing fallback', async () => {
  const fetchImpl = async (url) => {
    if (url.endsWith('/simulation/config')) {
      return {
        ok: false,
        status: 503,
        json: async () => ({ detail: 'Simulation service unavailable.' })
      };
    }
    throw new Error('Unexpected URL');
  };

  const storage = { get: async () => null, set: async () => {}, clear: async () => {} };
  const client = createClient({ baseUrl: 'https://api.example.com', storage, fetchImpl });

  await assert.rejects(
    () => client.getReferenceRate(),
    (err) => err.status === 503 || err.message.includes('unavailable')
  );
});

test('client.getReferenceRate: invalid rate responses (non-numeric, zero, negative, missing) fail closed', async () => {
  const invalidPayloads = [
    { inr_per_usd: 'not-a-number' },
    { inr_per_usd: '0' },
    { inr_per_usd: '-83.50' },
    { inr_per_usd: null },
    {},
  ];

  for (const payload of invalidPayloads) {
    const fetchImpl = async () => ({
      ok: true,
      status: 200,
      json: async () => payload
    });

    const storage = { get: async () => null, set: async () => {}, clear: async () => {} };
    const client = createClient({ baseUrl: 'https://api.example.com', storage, fetchImpl });

    await assert.rejects(
      () => client.getReferenceRate(),
      (err) => err.message === 'Reference rate temporarily unavailable',
      `Payload ${JSON.stringify(payload)} must fail closed`
    );
  }
});
