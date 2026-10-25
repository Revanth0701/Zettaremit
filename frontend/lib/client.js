// Platform-independent client; injectable storage and transport for offline tests.
function createClient({ baseUrl, allowHttp = false, storage, fetchImpl, onUnauthorized = () => {} }) {
  let parsed;
  try { parsed = new URL(baseUrl); } catch (_) { throw new Error('Configure a valid API base URL.'); }
  const clean = !parsed.username && !parsed.password && !parsed.search && !parsed.hash && parsed.pathname === '/';
  const loopback = ['localhost','127.0.0.1','[::1]'].includes(parsed.hostname);
  const valid = clean && (parsed.protocol === 'https:' || (allowHttp && loopback && parsed.protocol === 'http:'));
  if (!valid) throw new Error('Configure a valid HTTPS API base URL (loopback HTTP only for development).');
  async function request(path, { method = 'GET', body, authenticated = true, key } = {}) {
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
    const timer = setTimeout(() => controller.abort(), 15000);
    try {
      response = await fetchImpl(baseUrl.replace(/\/$/, '') + path, { method, headers, body: body ? JSON.stringify(body) : undefined, signal: controller.signal });
    } catch (_) {
      const error = new Error('Network request could not complete. Retry using the same request.');
      error.code = 'NETWORK'; throw error;
    }
    finally { clearTimeout(timer); }
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
      if (path === '/transactions/create' && response.status === 422) messages[422] = 'The quote is invalid or expired. Review a new quote before trying again.';
      if (path === '/users/login' && response.status === 422) messages[422] = 'Incorrect email or password. Please try again.';
      const error = new Error(messages[response.status] || 'The request could not be completed.');
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
    transfer: (body,key) => request('/transactions/create',{method:'POST',body,key}),
    config: () => request('/simulation/config',{authenticated:false}),
    session: () => storage.get(),
    async logout() { await storage.clear(); onUnauthorized(); }
  };
}
module.exports = { createClient };
