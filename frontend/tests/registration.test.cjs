const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createClient } = require('../lib/client');
const payload = { full_name: 'Synthetic', email: 'synthetic@example.com', password: 'Synthetic-password' };
function client(status, body) {
  return createClient({ baseUrl: 'https://api.example.com', storage: { get: async () => null }, fetchImpl: async () => ({ status, ok: status >= 200 && status < 300, json: async () => body }) });
}
test('registration requires 201 and the explicit created marker', async () => {
  const body = { status: 'created', message: 'Account created. Please sign in.' };
  assert.deepEqual(await client(201, body).register(payload), body);
  for (const [status, response] of [[200, body], [202, body], [204, {}], [201, { message: 'Generic eligibility response' }]]) {
    await assert.rejects(client(status, response).register(payload), error => error.code === 'INVALID_REGISTRATION_RESPONSE');
  }
});
test('409 gives a registration-specific error; 5xx errors remain safe and retryable', async () => {
  await assert.rejects(client(409, { detail: 'private database detail' }).register(payload), error => error.status === 409 && /already registered.*sign in/i.test(error.message));
  for (const status of [500, 502, 503]) {
    await assert.rejects(client(status, { detail: 'private database detail' }).register(payload), error => error.status === status && error.message === 'Unable to create your account right now. Please try again.');
  }
});

test('non-JSON upstream 5xx responses still give the safe registration retry message', async () => {
  const api = createClient({ baseUrl: 'https://api.example.com', storage: {}, fetchImpl: async () => ({ status: 502, ok: false, json: async () => { throw new Error('HTML gateway body'); } }) });
  await assert.rejects(api.register(payload), error => error.status === 502 && /Please try again/.test(error.message));
});

test('independent clients preserve exact passwords and normalize login email without shared sessions', async () => {
  const { randomBytes } = require('node:crypto');
  const password = ` ${randomBytes(20).toString('hex')}\u00e9 `;
  const email = 'cross-client@example.com';
  let registered, signupSession = null, loginSession = null;
  const calls = [];
  const fetchImpl = async (url, options) => {
    const body = JSON.parse(options.body);
    calls.push({ url, options });
    let status, response;
    if (url.endsWith('/users/register')) {
      registered = body;
      status = 201; response = { status: 'created' };
    } else {
      const valid = body.email === registered.email && body.password === registered.password;
      status = valid ? 200 : 401;
      response = valid ? { access_token: 'synthetic-session', expires_in: 900, full_name: 'Synthetic' } : {};
    }
    return { status, ok: status < 400, json: async () => response };
  };
  const signup = createClient({ baseUrl: 'https://api.example.com', fetchImpl, storage: {
    get: async () => signupSession, set: async value => { signupSession = value; }, clear: async () => { signupSession = null; },
  } });
  const login = createClient({ baseUrl: 'https://api.example.com', fetchImpl, storage: {
    get: async () => loginSession, set: async value => { loginSession = value; }, clear: async () => { loginSession = null; },
  } });
  // RegistrationWizard canonicalizes signup email before calling register().
  await signup.register({ full_name: 'Synthetic', email: ` ${email.toUpperCase()} `.trim().toLowerCase(), password });
  await login.login(` ${email.toUpperCase()} `, password);
  assert.ok(registered.password === password, 'Signup must preserve password bytes');
  assert.ok(JSON.parse(calls[1].options.body).password === password, 'Login must preserve password bytes');
  assert.ok(JSON.parse(calls[1].options.body).email === email, 'Login must canonicalize email');
  assert.ok(calls.every(call => call.options.headers.Authorization === undefined));
  assert.ok(signupSession === null && loginSession !== null, 'Sessions must be independent');
  assert.ok(!Object.hasOwn(loginSession, 'password'));
  await assert.rejects(login.login(email, password.trim()), error => error.status === 401);
});
