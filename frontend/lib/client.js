// Platform-independent client; injectable storage and transport for offline tests.
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
    transfer: (body,key) => request('/transactions/create',{method:'POST',body,key}),
    config: () => request('/simulation/config',{authenticated:false}),
    health: ({ timeoutMs, signal } = {}) => request('/health',{authenticated:false,timeoutMs:timeoutMs||10000,signal}),
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
module.exports = { createClient };
