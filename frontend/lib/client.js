// Platform-independent client; injectable storage and transport for offline tests.
const { triggerBackgroundWakeup } = require('./readiness');

// ─────────────────────────────────────────────────────────────────────────────
// Public direct reference-rate fetch — bypasses Render when it is sleeping.
//
// Source : open.er-api.com/v6/latest/USD
//          Free, keyless, CORS: Access-Control-Allow-Origin: *
//          Updates once per day.  No API key is required or exposed.
//
// Freshness: rate observation must be within 96 hours — identical to the
//            backend ExchangeRateProvider.MAX_AGE policy — so the displayed
//            rate is never stale beyond the same window Render accepts.
//
// Attribution: "Rates By Exchange Rate API" / https://www.exchangerate-api.com
//              Must be shown wherever the rate is displayed (ToS requirement).
// ─────────────────────────────────────────────────────────────────────────────
const PUBLIC_RATE_ENDPOINT = 'https://open.er-api.com/v6/latest/USD';
const PUBLIC_RATE_MAX_AGE_MS = 96 * 60 * 60 * 1000; // 96 h — matches backend policy
const PUBLIC_RATE_ATTRIBUTION = 'Rates By Exchange Rate API';
const PUBLIC_RATE_ATTRIBUTION_URL = 'https://www.exchangerate-api.com';
const PUBLIC_RATE_TIMEOUT_MS = 8000;
const PUBLIC_RATE_MAX_BYTES = 128 * 1024; // matches backend MAX_RESPONSE_BYTES

/**
 * Validate an open.er-api.com response payload (already parsed from JSON)
 * against the same invariants the Python backend enforces.
 *
 * Returns a validated rate object, or throws an Error so callers can treat
 * the result as "unavailable" without crashing.
 *
 * @param {object} data   - Parsed JSON from open.er-api.com
 * @param {number} nowMs  - Current wall-clock time in milliseconds
 */
function _validatePublicRatePayload(data, nowMs) {
  if (!data || typeof data !== 'object') throw new Error('Invalid response structure');
  if (data.result !== 'success') throw new Error('Provider result not success');
  if (data.base_code !== 'USD') throw new Error('Unexpected base currency');
  const rates = data.rates;
  if (!rates || typeof rates !== 'object') throw new Error('Missing rates object');
  // USD=1 sanity guard (mirrors Python backend check)
  if (rates.USD !== 1) throw new Error('USD base rate sanity check failed');
  const raw = rates.INR;
  if (typeof raw !== 'number' && typeof raw !== 'string') throw new Error('INR rate missing or wrong type');
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0 || parsed >= 10000000000) {
    throw new Error('INR rate out of valid range');
  }
  // Validate observation / schedule timestamps
  const lastUpdateUnix = data.time_last_update_unix;
  const nextUpdateUnix = data.time_next_update_unix;
  if (typeof lastUpdateUnix !== 'number' || lastUpdateUnix <= 0) throw new Error('Invalid observed timestamp');
  if (typeof nextUpdateUnix !== 'number' || nextUpdateUnix <= lastUpdateUnix) throw new Error('Invalid next-update timestamp');
  const observedMs = lastUpdateUnix * 1000;
  if (observedMs > nowMs) throw new Error('Observed timestamp is in the future');
  const ageMs = nowMs - observedMs;
  if (ageMs > PUBLIC_RATE_MAX_AGE_MS) {
    const ageDays = (ageMs / (1000 * 60 * 60 * 24)).toFixed(1);
    throw new Error(`Rate observation is stale (${ageDays} days old; max ${PUBLIC_RATE_MAX_AGE_MS / 3600000}h)`);
  }
  // Round to 8 decimal places — matches backend DECIMAL(18,8) schema
  const roundedRate = Math.round(parsed * 1e8) / 1e8;
  return {
    rate: roundedRate,
    inr_per_usd: parsed.toFixed(8),
    observed_at: new Date(observedMs).toISOString(),
    next_update_at: new Date(nextUpdateUnix * 1000).toISOString(),
    attribution_text: PUBLIC_RATE_ATTRIBUTION,
    attribution_url: PUBLIC_RATE_ATTRIBUTION_URL,
    source: 'public_direct',
  };
}

/**
 * Fetch the USD/INR reference rate directly from open.er-api.com.
 *
 * - CORS-compatible (Access-Control-Allow-Origin: *)
 * - No API key required or exposed
 * - Validates response structure and freshness identically to the backend
 * - Accepts an injected fetchImpl for deterministic unit tests
 *
 * Returns a validated rate object, or throws if unavailable / stale / invalid.
 */
async function fetchPublicReferenceRate({
  fetchImpl: _fetchImpl,
  signal,
  timeoutMs = PUBLIC_RATE_TIMEOUT_MS,
} = {}) {
  // Use the injected fetchImpl (tests) or the global browser fetch
  const fetcher = _fetchImpl || (typeof fetch !== 'undefined' ? fetch : null);
  if (!fetcher) throw new Error('No fetch implementation available');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let abortListener;
  if (signal) {
    if (signal.aborted) { controller.abort(); }
    else if (signal.addEventListener) {
      abortListener = () => controller.abort();
      signal.addEventListener('abort', abortListener, { once: true });
    }
  }

  let response;
  try {
    response = await fetcher(PUBLIC_RATE_ENDPOINT, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
  } catch (err) {
    if (err && err.name === 'AbortError') {
      const e = new Error('Public rate fetch timed out');
      e.code = 'TIMEOUT';
      throw e;
    }
    const e = new Error('Public rate fetch network error');
    e.code = 'NETWORK';
    throw e;
  } finally {
    clearTimeout(timer);
    if (signal && abortListener && signal.removeEventListener) {
      signal.removeEventListener('abort', abortListener);
    }
  }

  if (!response.ok) {
    const e = new Error(`Public rate provider returned HTTP ${response.status}`);
    e.status = response.status;
    e.code = response.status === 429 ? 'RATE_LIMITED' : 'PROVIDER_HTTP_ERROR';
    throw e;
  }

  // Guard oversized responses (matches backend MAX_RESPONSE_BYTES)
  let text;
  try { text = await response.text(); } catch (_) {
    throw new Error('Public rate response unreadable');
  }
  if (text.length > PUBLIC_RATE_MAX_BYTES) throw new Error('Public rate response too large');

  let data;
  try { data = JSON.parse(text); } catch (_) {
    throw new Error('Public rate response is not valid JSON');
  }

  return _validatePublicRatePayload(data, Date.now());
}

function createClient({ baseUrl, allowHttp = false, storage, fetchImpl, onUnauthorized = () => {} }) {
  let parsed;
  try { parsed = new URL(baseUrl); } catch (_) { throw new Error('Configure a valid API base URL.'); }
  const clean = !parsed.username && !parsed.password && !parsed.search && !parsed.hash && parsed.pathname === '/';
  const loopback = ['localhost','127.0.0.1','[::1]'].includes(parsed.hostname);
  const valid = clean && (parsed.protocol === 'https:' || (allowHttp && loopback && parsed.protocol === 'http:'));
  if (!valid) throw new Error('Configure a valid HTTPS API base URL (loopback HTTP only for development).');
  async function request(path, { method = 'GET', body, authenticated = true, key, timeoutMs, signal } = {}) {
    const headers = { 'Content-Type': 'application/json' };
    if (authenticated) {
      const session = await storage.get();
      if (!session || session.expiresAt <= Date.now()) {
        await storage.clear(); onUnauthorized(); throw new Error('Please sign in again.');
      }
      headers.Authorization = `Bearer ${session.token}`;
    }
    if (key) headers['Idempotency-Key'] = key;
    let response;
    const controller = new AbortController();
    const timeout = timeoutMs || 15000;
    const timer = setTimeout(() => controller.abort(), timeout);
    let abortListener;
    if (signal) {
      if (signal.aborted) {
        controller.abort();
      } else if (signal.addEventListener) {
        abortListener = () => controller.abort();
        signal.addEventListener('abort', abortListener, { once: true });
      }
    }
    try {
      response = await fetchImpl(baseUrl.replace(/\/$/, '') + path, { method, headers, body: body ? JSON.stringify(body) : undefined, signal: controller.signal });
    } catch (err) {
      if (signal && signal.aborted) {
        const error = new Error('The request was cancelled.');
        error.code = 'ABORT';
        error.status = 0;
        throw error;
      }
      if (err && err.name === 'AbortError') {
        const error = new Error('The request timed out. Please try again.');
        error.code = 'TIMEOUT';
        error.status = 504;
        throw error;
      }
      const error = new Error('Network request could not complete. Retry using the same request.');
      error.code = 'NETWORK'; throw error;
    }
    finally {
      clearTimeout(timer);
      if (signal && abortListener && signal.removeEventListener) {
        signal.removeEventListener('abort', abortListener);
      }
    }
    let data;
    try { data = await response.json(); } catch (_) {
      const error = new Error('The service returned an invalid response.'); error.code = 'INVALID_RESPONSE'; throw error;
    }
    if (response.status === 401) {
      if (authenticated) {
        await storage.clear(); onUnauthorized();
        const error = new Error('Please sign in again.');
        error.status = 401;
        throw error;
      }
      const error = new Error('Incorrect email or password. Please try again.');
      error.status = 401;
      throw error;
    }
    if (!response.ok) {
      const messages = {400:'Check your supplied details.',403:'This operation is not permitted.',409:'Request conflict. Review the transfer before retrying.',422:'Check the required fields and amount (up to two decimals).',429:'Too many attempts. Please wait before retrying.',503:'Simulation service unavailable. Retry the same request shortly.'};
      if (path === '/simulation/quote' && response.status === 503) messages[503] = 'Daily reference rates or the quote service are unavailable. Please try again later.';
      if (path === '/simulation/rate' && response.status === 503) messages[503] = 'Exchange rate temporarily unavailable';
      if (path === '/transactions/create' && response.status === 422) messages[422] = 'The quote is invalid or expired. Review a new quote before trying again.';
      if (path === '/users/login' && response.status === 422) messages[422] = 'Incorrect email or password. Please try again.';
      if (path === '/ai/ask') {
        if (response.status === 429) messages[429] = 'The AI assistant is busy processing another query. Please wait a moment and retry.';
        if (response.status === 503) messages[503] = 'The local AI service is currently unavailable. Ensure Ollama is running.';
        if (response.status === 504) messages[504] = 'The AI request timed out. Please ask a shorter question or retry.';
        if (response.status === 422) messages[422] = 'Please enter a valid question (up to 1,000 characters).';
      }
      const message = (path.startsWith('/ai') && data && typeof data.detail === 'string') ? data.detail : (messages[response.status] || 'The request could not be completed.');
      const error = new Error(message);
      error.status = response.status; throw error;
    }
    return data;
  }
  return {
    request,
    async login(email, password) {
      try {
        const data = await request('/users/login', { method:'POST', body:{email:email.trim().toLowerCase(),password}, authenticated:false });
        if (typeof data.access_token !== 'string' || !Number.isFinite(data.expires_in) || data.expires_in <= 0) throw new Error('Invalid sign-in response.');
        await storage.set({token:data.access_token,expiresAt:Date.now()+data.expires_in*1000,fullName:data.full_name});
        return {full_name:data.full_name};
      } catch (err) {
        if (err.code === 'NETWORK') {
          const networkError = new Error('Unable to connect. Please try again later.');
          networkError.code = 'NETWORK';
          throw networkError;
        }
        throw err;
      }
    },
    register: body => request('/users/register',{method:'POST',body,authenticated:false}),
    history: () => request('/transactions/'),
    quote: body => request('/simulation/quote',{method:'POST',body}),
    rate: () => request('/simulation/rate',{authenticated:true}),

    /**
     * getReferenceRate — public homepage rate resolution with three-tier fallback:
     *
     *  1. Authenticated /simulation/rate   (Render; logged-in users only)
     *  2. Direct open.er-api.com fetch     (CORS-compatible; works when Render sleeps)
     *  3. Unauthenticated /simulation/config (Render; public endpoint; last resort)
     *
     * Tier 2 allows public visitors to see a live indicative INR/USD rate
     * even when the Render Free backend has not yet warmed up.  The rate is
     * validated to the same freshness and range rules as the backend.
     *
     * The Render backend remains the authoritative source for authenticated
     * simulation quotes and transactions.
     */
    getReferenceRate: async ({ signal, timeoutMs = 8000, publicFetchImpl } = {}) => {
      // ── Tier 1: authenticated Render rate (logged-in users) ──────────────
      const session = await storage.get();
      if (session && session.token && session.expiresAt > Date.now()) {
        try {
          const data = await request('/simulation/rate', { authenticated: true, signal, timeoutMs });
          if (data && data.inr_per_usd) {
            const parsed = parseFloat(data.inr_per_usd);
            if (Number.isFinite(parsed) && parsed > 0) {
              return {
                rate: parsed,
                inr_per_usd: String(data.inr_per_usd),
                observed_at: data.observed_at || null,
                attribution_text: data.attribution_text || 'Rates By Exchange Rate API',
                source: 'authenticated',
              };
            }
          }
        } catch (err) {
          // Only swallow network / auth errors; rethrow unexpected ones
          if (err && err.status !== 401 && err.code !== 'NETWORK' && err.code !== 'TIMEOUT') throw err;
        }
      }

      // ── Tier 2: direct open.er-api.com (public, CORS, no API key) ────────
      // This path works independently of Render.  Errors here are non-fatal;
      // we fall through to tier 3 so the UI can still try Render config.
      try {
        const publicRate = await fetchPublicReferenceRate({
          fetchImpl: publicFetchImpl || fetchImpl,
          signal,
          timeoutMs,
        });
        return publicRate; // source: 'public_direct'
      } catch (_publicErr) {
        // Tier 2 failure is expected when offline or rate-limited — fall through
      }

      // ── Tier 3: unauthenticated /simulation/config (Render public endpoint) ──
      try {
        const config = await request('/simulation/config', { authenticated: false, signal, timeoutMs });
        if (config && config.inr_per_usd) {
          const parsed = parseFloat(config.inr_per_usd);
          if (Number.isFinite(parsed) && parsed > 0) {
            return {
              rate: parsed,
              inr_per_usd: String(config.inr_per_usd),
              observed_at: config.observed_at || null,
              attribution_text: config.attribution_text || 'Platform Reference Rate',
              source: 'public_config',
            };
          }
        }
      } catch (_configErr) {
        // Render is sleeping — all tiers exhausted
      }

      const err = new Error('Reference rate temporarily unavailable');
      err.status = 503;
      throw err;
    },
    transfer: (body,key) => request('/transactions/create',{method:'POST',body,key}),
    config: () => request('/simulation/config',{authenticated:false}),
    health: ({ timeoutMs, signal } = {}) => request('/health',{authenticated:false,timeoutMs:timeoutMs||10000,signal}),
    wakeBackend: ({ timeoutMs = 15000, signal } = {}) =>
      triggerBackgroundWakeup({
        checkHealth: ({ timeoutMs: to, signal: sig } = {}) =>
          request('/health', { authenticated: false, timeoutMs: to || timeoutMs, signal: sig || signal }),
        timeoutMs,
        signal
      }),
    aiHealth: () => request('/ai/health',{authenticated:false,timeoutMs:5000}),
    aiAsk: (question,session_id) => request('/ai/ask',{method:'POST',body:{question,session_id},authenticated:true,timeoutMs:120000}),
    aiAskStream: async (question, session_id, { onChunk, onSources, onDone, onError, signal } = {}) => {
      const session = await storage.get();
      if (!session || session.expiresAt <= Date.now()) {
        await storage.clear(); onUnauthorized();
        const err = new Error('Please sign in again.');
        err.status = 401;
        if (onError) onError(err);
        throw err;
      }
      const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.token}`
      };
      let response;
      try {
        response = await fetchImpl(baseUrl.replace(/\/$/, '') + '/ai/ask-stream', {
          method: 'POST',
          headers,
          body: JSON.stringify({ question, session_id }),
          signal
        });
      } catch (err) {
        if (err && err.name === 'AbortError') {
          const abortErr = new Error('The request timed out. Please try again.');
          abortErr.code = 'TIMEOUT';
          abortErr.status = 504;
          if (onError) onError(abortErr);
          throw abortErr;
        }
        const netErr = new Error('Network request could not complete. Retry using the same request.');
        netErr.code = 'NETWORK';
        if (onError) onError(netErr);
        throw netErr;
      }

      if (response.status === 401) {
        await storage.clear(); onUnauthorized();
        const authErr = new Error('Please sign in again.');
        authErr.status = 401;
        if (onError) onError(authErr);
        throw authErr;
      }

      if (!response.ok) {
        let msg = 'The request could not be completed.';
        try {
          const data = await response.json();
          if (data && typeof data.detail === 'string') msg = data.detail;
        } catch (_) {}
        const err = new Error(msg);
        err.status = response.status;
        if (onError) onError(err);
        throw err;
      }

      let fullText = '';
      let sources = [];
      let latency = 0;

      if (response.body && typeof response.body.getReader === 'function') {
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n\n');
            buffer = lines.pop() || '';
            for (const line of lines) {
              const trimmed = line.trim();
              if (trimmed.startsWith('data: ')) {
                try {
                  const evt = JSON.parse(trimmed.slice(6));
                  if (evt.type === 'start') {
                    if (evt.sources) {
                      sources = evt.sources;
                      if (onSources) onSources(sources);
                    }
                  } else if (evt.type === 'chunk') {
                    const chunk = evt.content || '';
                    fullText += chunk;
                    if (onChunk) onChunk(chunk, fullText);
                  } else if (evt.type === 'done') {
                    if (evt.sources) sources = evt.sources;
                    if (typeof evt.latency_seconds === 'number') latency = evt.latency_seconds;
                  } else if (evt.type === 'error') {
                    const streamErr = new Error(evt.error || 'AI generation failed');
                    if (onError) onError(streamErr);
                    throw streamErr;
                  }
                } catch (pe) {
                  if (pe.message && pe.message.includes('AI generation failed')) throw pe;
                }
              }
            }
          }
        } catch (streamErr) {
          if (onError) onError(streamErr);
          throw streamErr;
        }
      } else {
        const text = await response.text();
        fullText = text;
        if (onChunk) onChunk(text, fullText);
      }

      if (onDone) onDone({ answer: fullText, sources, latency_seconds: latency });
      return { answer: fullText, sources, latency_seconds: latency };
    },
    session: () => storage.get(),
    async logout() { await storage.clear(); onUnauthorized(); }
  };
}
module.exports = { createClient, fetchPublicReferenceRate, _validatePublicRatePayload, PUBLIC_RATE_ENDPOINT, PUBLIC_RATE_MAX_AGE_MS, PUBLIC_RATE_ATTRIBUTION };
