const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { triggerBackgroundWakeup, markBackendAwake } = require('../lib/readiness');
const { createClient, fetchPublicReferenceRate, _validatePublicRatePayload, PUBLIC_RATE_ENDPOINT, PUBLIC_RATE_MAX_AGE_MS, PUBLIC_RATE_ATTRIBUTION } = require('../lib/client');

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

  // 6. Labels rate as "Indicative Reference Rate" (not simply "Reference Exchange Rate")
  assert.match(calcSrc, /Indicative Reference Rate/);

  // 7. Payout notice must NOT claim the rate is "Locked" or "guaranteed"
  assert.doesNotMatch(calcSrc, /Locked securely upon simulated quote generation/,
    'Must not claim the indicative rate is locked or guaranteed');
  assert.match(calcSrc, /not a locked or guaranteed rate/,
    'Must explicitly state the public indicative rate is not locked or guaranteed');

  // 8. Attribution subtext says "Indicative reference rate" (not "Indicative benchmark")
  assert.match(calcSrc, /Indicative reference rate/);
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

  // publicFetchImpl fails so tier 2 is skipped and tier 3 (/simulation/config) is exercised
  const result = await client.getReferenceRate({
    publicFetchImpl: async () => { throw new Error('public rate unavailable in this test'); },
  });
  assert.equal(result.rate, 95.25);
  assert.equal(result.inr_per_usd, '95.25000000');
  assert.equal(result.attribution_text, 'Rates By Exchange Rate API');
  assert.equal(result.observed_at, '2026-10-27T00:00:00Z');
  // Must have called /simulation/config without an Authorization header
  const configCall = calls.find(c => c.url.endsWith('/simulation/config'));
  assert.ok(configCall, 'Must have called /simulation/config');
  assert.equal(configCall.opts.headers.Authorization, undefined, 'Must not send Authorization header for public unauthenticated request');
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


// =============================================================================
// TIER-2 PUBLIC DIRECT RATE TESTS (open.er-api.com — Render-independent path)
// =============================================================================

// Helper: build a realistic valid open.er-api.com response payload
function makeValidOpenErPayload({ inrRate = 84.5, ageMs = 3600000 } = {}) {
  const nowMs = Date.now();
  const observedUnix = Math.floor((nowMs - ageMs) / 1000);
  const nextUnix = observedUnix + 86400; // 24 h later
  return {
    result: 'success',
    base_code: 'USD',
    rates: { USD: 1, INR: inrRate, EUR: 0.91, GBP: 0.79 },
    time_last_update_unix: observedUnix,
    time_next_update_unix: nextUnix,
  };
}

test('fetchPublicReferenceRate: is exported from client module', () => {
  assert.equal(typeof fetchPublicReferenceRate, 'function', 'fetchPublicReferenceRate must be exported');
  assert.ok(PUBLIC_RATE_ENDPOINT.startsWith('https://open.er-api.com'), 'PUBLIC_RATE_ENDPOINT must point to open.er-api.com');
  assert.equal(PUBLIC_RATE_ATTRIBUTION, 'Rates By Exchange Rate API');
});

test('fetchPublicReferenceRate: returns validated rate with correct shape on success', async () => {
  const payload = makeValidOpenErPayload({ inrRate: 84.5, ageMs: 7200000 });
  const mockFetch = async () => ({
    ok: true,
    status: 200,
    text: async () => JSON.stringify(payload),
  });

  const result = await fetchPublicReferenceRate({ fetchImpl: mockFetch });
  assert.ok(Number.isFinite(result.rate) && result.rate > 0, 'rate must be positive finite');
  assert.equal(typeof result.inr_per_usd, 'string', 'inr_per_usd must be a string');
  assert.equal(typeof result.observed_at, 'string', 'observed_at must be ISO string');
  assert.equal(typeof result.next_update_at, 'string', 'next_update_at must be ISO string');
  assert.equal(result.attribution_text, 'Rates By Exchange Rate API');
  assert.equal(result.attribution_url, 'https://www.exchangerate-api.com');
  assert.equal(result.source, 'public_direct');
});

test('fetchPublicReferenceRate: handles HTTP 429 rate limit with RATE_LIMITED code', async () => {
  const mockFetch = async () => ({
    ok: false,
    status: 429,
    text: async () => 'Too Many Requests',
  });

  await assert.rejects(
    () => fetchPublicReferenceRate({ fetchImpl: mockFetch }),
    (err) => err.code === 'RATE_LIMITED' && err.status === 429
  );
});

test('fetchPublicReferenceRate: handles HTTP 503 with PROVIDER_HTTP_ERROR code', async () => {
  const mockFetch = async () => ({
    ok: false,
    status: 503,
    text: async () => 'Service Unavailable',
  });

  await assert.rejects(
    () => fetchPublicReferenceRate({ fetchImpl: mockFetch }),
    (err) => err.code === 'PROVIDER_HTTP_ERROR' && err.status === 503
  );
});

test('fetchPublicReferenceRate: handles network failure (ECONNREFUSED / offline) with NETWORK code', async () => {
  const mockFetch = async () => {
    const err = new Error('Network failure');
    throw err;
  };

  await assert.rejects(
    () => fetchPublicReferenceRate({ fetchImpl: mockFetch }),
    (err) => err.code === 'NETWORK'
  );
});

test('fetchPublicReferenceRate: handles AbortError timeout with TIMEOUT code', async () => {
  const mockFetch = async () => {
    const err = new Error('Timed out');
    err.name = 'AbortError';
    throw err;
  };

  await assert.rejects(
    () => fetchPublicReferenceRate({ fetchImpl: mockFetch }),
    (err) => err.code === 'TIMEOUT'
  );
});

test('fetchPublicReferenceRate: rejects invalid JSON response', async () => {
  const mockFetch = async () => ({
    ok: true,
    status: 200,
    text: async () => 'this is not json {{{',
  });

  await assert.rejects(
    () => fetchPublicReferenceRate({ fetchImpl: mockFetch }),
    (err) => err.message.includes('not valid JSON')
  );
});

test('fetchPublicReferenceRate: rejects oversized response (> 128 KB)', async () => {
  const oversizedText = 'x'.repeat(128 * 1024 + 1);
  const mockFetch = async () => ({
    ok: true,
    status: 200,
    text: async () => oversizedText,
  });

  await assert.rejects(
    () => fetchPublicReferenceRate({ fetchImpl: mockFetch }),
    (err) => err.message.includes('too large')
  );
});

// _validatePublicRatePayload unit tests
test('_validatePublicRatePayload: stale observation beyond 96 hours is rejected', () => {
  const staleAgeMs = PUBLIC_RATE_MAX_AGE_MS + 1;
  const nowMs = Date.now();
  const observedUnix = Math.floor((nowMs - staleAgeMs) / 1000);
  const payload = makeValidOpenErPayload({ ageMs: staleAgeMs });
  payload.time_last_update_unix = observedUnix;
  payload.time_next_update_unix = observedUnix + 86400;

  assert.throws(
    () => _validatePublicRatePayload(payload, nowMs),
    (err) => err.message.includes('stale')
  );
});

test('_validatePublicRatePayload: future observation timestamp is rejected', () => {
  const nowMs = Date.now();
  const futureObservedUnix = Math.floor(nowMs / 1000) + 86400; // 24 h in the future
  const payload = {
    result: 'success',
    base_code: 'USD',
    rates: { USD: 1, INR: 84.5 },
    time_last_update_unix: futureObservedUnix,
    time_next_update_unix: futureObservedUnix + 86400, // also in the future
  };

  assert.throws(
    () => _validatePublicRatePayload(payload, nowMs),
    (err) => err.message.includes('future') || err.message.includes('Invalid') || err.message.includes('stale')
  );
});

test('_validatePublicRatePayload: zero INR rate is rejected', () => {
  const nowMs = Date.now();
  const payload = makeValidOpenErPayload();
  payload.rates.INR = 0;

  assert.throws(
    () => _validatePublicRatePayload(payload, nowMs),
    (err) => err.message.includes('range') || err.message.includes('Invalid')
  );
});

test('_validatePublicRatePayload: negative INR rate is rejected', () => {
  const nowMs = Date.now();
  const payload = makeValidOpenErPayload();
  payload.rates.INR = -84.5;

  assert.throws(
    () => _validatePublicRatePayload(payload, nowMs),
    (err) => err.message.includes('range') || err.message.includes('Invalid')
  );
});

test('_validatePublicRatePayload: non-success result is rejected', () => {
  const nowMs = Date.now();
  const payload = makeValidOpenErPayload();
  payload.result = 'error';

  assert.throws(
    () => _validatePublicRatePayload(payload, nowMs),
    (err) => err.message.includes('not success')
  );
});

test('_validatePublicRatePayload: wrong base currency is rejected', () => {
  const nowMs = Date.now();
  const payload = makeValidOpenErPayload();
  payload.base_code = 'EUR'; // should be USD

  assert.throws(
    () => _validatePublicRatePayload(payload, nowMs),
    (err) => err.message.includes('base currency')
  );
});

test('_validatePublicRatePayload: USD=1 sanity check — if USD rate is not 1, rejected', () => {
  const nowMs = Date.now();
  const payload = makeValidOpenErPayload();
  payload.rates.USD = 0.5; // inverted or mislabeled

  assert.throws(
    () => _validatePublicRatePayload(payload, nowMs),
    (err) => err.message.includes('sanity') || err.message.includes('USD')
  );
});

test('_validatePublicRatePayload: 8-decimal precision rounding matches backend DECIMAL(18,8)', () => {
  const nowMs = Date.now();
  const payload = makeValidOpenErPayload({ inrRate: 84.123456789 }); // >8 decimal places
  const result = _validatePublicRatePayload(payload, nowMs);
  // inr_per_usd must be formatted to exactly 8 decimal places
  assert.match(result.inr_per_usd, /^\d+\.\d{8}$/,
    'inr_per_usd must have exactly 8 decimal places');
});

// =============================================================================
// THREE-TIER FALLBACK INTEGRATION TESTS
// =============================================================================

test('getReferenceRate tier-2: uses public direct rate when Render is sleeping (all Render calls fail)', async () => {
  const validPayload = makeValidOpenErPayload({ inrRate: 84.5, ageMs: 3600000 });

  // fetchImpl always throws (Render is sleeping)
  const fetchImpl = async () => {
    const err = new Error('Connection refused — Render is sleeping');
    err.code = 'NETWORK';
    throw err;
  };

  // publicFetchImpl returns a valid open.er-api.com response
  const publicFetchImpl = async (url) => {
    assert.ok(url.startsWith('https://open.er-api.com'), 'Must call open.er-api.com');
    return {
      ok: true,
      status: 200,
      text: async () => JSON.stringify(validPayload),
    };
  };

  const storage = { get: async () => null, set: async () => {}, clear: async () => {} };
  const client = createClient({ baseUrl: 'https://api.example.com', storage, fetchImpl });

  const result = await client.getReferenceRate({ publicFetchImpl });
  assert.equal(result.source, 'public_direct', 'Must return source=public_direct when using tier 2');
  assert.ok(Number.isFinite(result.rate) && result.rate > 0);
  assert.equal(result.attribution_text, 'Rates By Exchange Rate API');
  assert.equal(typeof result.observed_at, 'string');
});

test('getReferenceRate tier-2: falls through to tier-3 when public direct also fails', async () => {
  // Tier 2 fails (public rate unavailable)
  const publicFetchImpl = async () => {
    throw new Error('open.er-api.com unreachable');
  };

  // Tier 3: /simulation/config responds with a valid rate
  const fetchImpl = async (url) => {
    if (url.endsWith('/simulation/config')) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          inr_per_usd: '83.75000000',
          observed_at: '2026-10-27T00:00:00Z',
          attribution_text: 'Platform Reference Rate',
          simulation: true,
        }),
      };
    }
    throw new Error('Unexpected URL: ' + url);
  };

  const storage = { get: async () => null, set: async () => {}, clear: async () => {} };
  const client = createClient({ baseUrl: 'https://api.example.com', storage, fetchImpl });

  const result = await client.getReferenceRate({ publicFetchImpl });
  assert.equal(result.source, 'public_config', 'Falls through to tier-3 /simulation/config');
  assert.equal(result.rate, 83.75);
});

test('getReferenceRate: all three tiers fail → throws 503 with correct message', async () => {
  // All fetches throw
  const fetchImpl = async () => { throw new Error('All offline'); };
  const publicFetchImpl = async () => { throw new Error('Public rate offline'); };

  const storage = { get: async () => null, set: async () => {}, clear: async () => {} };
  const client = createClient({ baseUrl: 'https://api.example.com', storage, fetchImpl });

  await assert.rejects(
    () => client.getReferenceRate({ publicFetchImpl }),
    (err) => err.message === 'Reference rate temporarily unavailable' && err.status === 503
  );
});

test('getReferenceRate tier-2: does NOT expose any API key in the public rate request', async () => {
  const validPayload = makeValidOpenErPayload();
  let capturedHeaders = null;

  const publicFetchImpl = async (_url, opts) => {
    capturedHeaders = opts && opts.headers ? opts.headers : {};
    return {
      ok: true,
      status: 200,
      text: async () => JSON.stringify(validPayload),
    };
  };

  const fetchImpl = async () => { throw new Error('Render sleeping'); };
  const storage = { get: async () => null, set: async () => {}, clear: async () => {} };
  const client = createClient({ baseUrl: 'https://api.example.com', storage, fetchImpl });

  await client.getReferenceRate({ publicFetchImpl });

  // Must NOT contain Authorization header or API key of any kind
  const headerStr = JSON.stringify(capturedHeaders || {}).toLowerCase();
  assert.ok(!headerStr.includes('authorization'), 'Must not send Authorization header to public rate endpoint');
  assert.ok(!headerStr.includes('x-api-key'), 'Must not send x-api-key header to public rate endpoint');
  assert.ok(!headerStr.includes('apikey'), 'Must not send apikey header to public rate endpoint');
});

test('client.js: exports PUBLIC_RATE_MAX_AGE_MS === 96 hours (matches backend policy)', () => {
  assert.equal(PUBLIC_RATE_MAX_AGE_MS, 96 * 60 * 60 * 1000, 'Must be 96 hours in milliseconds');
});

test('TransferCalculatorPreview: labels rate as Indicative Reference Rate (not claims to be locked or guaranteed)', () => {
  const calcSrc = readSrc('components/TransferCalculatorPreview.js');
  // Must label rate as "Indicative Reference Rate" in the breakdown
  assert.match(calcSrc, /Indicative Reference Rate/,
    'Must label the rate as "Indicative Reference Rate" in the breakdown card');
  // Must label the payout notice as indicative/not-locked
  assert.match(calcSrc, /not a locked or guaranteed rate/,
    'Payout notice must say rate is not locked or guaranteed');
  // Must NOT say "Locked securely" (which implies a real rate lock)
  assert.doesNotMatch(calcSrc, /Locked securely upon simulated quote generation/,
    'Must not claim the public indicative rate is locked');
  // Attribution subtext must use "Indicative reference rate" label
  assert.match(calcSrc, /Indicative reference rate/,
    'Attribution subtext must say "Indicative reference rate"');
});
