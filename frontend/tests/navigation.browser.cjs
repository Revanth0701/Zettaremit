// Focused navigation checks against the running Expo server. All backend requests are mocked.
const assert = require('node:assert/strict');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || path.resolve(__dirname, '../../.local-backups/browser-verification/node_modules/playwright'));
const origin = process.env.UX_TEST_ORIGIN || 'http://localhost:8081';
(async () => {
  const browser = await chromium.launch({ headless: true, channel: process.env.PLAYWRIGHT_CHANNEL || 'msedge' });
  async function setup(width, seed = {}) {
    const context = await browser.newContext({ viewport: { width, height: 900 } });
    const api = { invalid: false, loginCalls: 0, historyCalls: 0, writes: [] };
    await context.route('**/*', route => {
      const request = route.request(), url = new URL(request.url());
      if (url.origin === origin) return route.continue();
      let body = {}, status = 200;
      if (request.method() === 'POST') api.writes.push(url.pathname);
      if (['/health', '/ai/health'].includes(url.pathname)) body = { status: 'ok' };
      if (url.pathname === '/transactions/') { api.historyCalls++; body = []; if (api.invalid) status = 401; }
      if (url.pathname === '/users/register') { status = 201; body = { status: 'created', message: 'Account created. Please sign in.' }; }
      if (url.pathname === '/users/login') { api.loginCalls++; body = { access_token: 'synthetic-token', expires_in: 3600, full_name: 'Test User' }; }
      if (url.pathname === '/simulation/rate') body = { inr_per_usd: '84.50000000', observed_at: new Date().toISOString() };
      return route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
    });
    await context.addInitScript(seed => {
      if (!sessionStorage.getItem('navigation-check-seeded')) {
        sessionStorage.setItem('navigation-check-seeded', 'true');
        if (seed.route) sessionStorage.setItem('zettaremit-navigation', JSON.stringify(seed.route));
        if (seed.session) sessionStorage.setItem('zettaremit-session', JSON.stringify(seed.session));
      }
      window.__splashCount = 0;
      let visible = false;
      new MutationObserver(() => {
        const current = !!document.querySelector('[data-testid="launch_splash"]');
        if (current && !visible) window.__splashCount++;
        visible = current;
      }).observe(document, { childList: true, subtree: true });
    }, seed);
    const page = await context.newPage();
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    return { context, page, api, errors };
  }
  const splashCount = page => page.evaluate(() => window.__splashCount);
  const welcome = page => page.getByRole('button', { name: 'Sign-up', exact: true }).waitFor();
  const login = async page => {
    await page.getByLabel('Email Address', { exact: true }).fill('test@example.com');
    await page.getByLabel('Password', { exact: true }).fill('Long-test-password');
    await page.getByRole('button', { name: 'Login', exact: true }).click();
    await page.getByRole('button', { name: 'ZettaAI Assistant', exact: true }).first().waitFor();
  };
  try {
    for (const width of [1280, 390]) {
      const { context, page, api, errors } = await setup(width);
      await page.goto(origin, { waitUntil: 'domcontentloaded', timeout: 90000 });
      await page.getByText('A simpler way to simulate international money transfers.', { exact: true }).last().waitFor();
      assert.equal(await splashCount(page), 1, 'Fresh launch must show exactly one splash');
      await page.getByRole('button', { name: 'Get Started', exact: true }).first().click();
      await welcome(page);
      await page.getByText('Back to Homepage', { exact: false }).last().click();
      await page.getByText('A simpler way to simulate international money transfers.', { exact: true }).last().waitFor();
      await page.getByRole('button', { name: 'Get Started', exact: true }).first().click();
      await welcome(page);
      await page.getByRole('button', { name: 'Login', exact: true }).click();
      await page.getByRole('button', { name: 'Back to Welcome', exact: true }).focus();
      await page.keyboard.press('Enter'); await welcome(page);
      assert.equal(await splashCount(page), 1, 'Internal navigation must not replay splash');
      await page.getByRole('button', { name: 'Sign-up', exact: true }).click();
      await page.getByLabel('Email Address', { exact: true }).fill('test@example.com');
      await page.getByLabel('Password', { exact: true }).fill('Long-test-password');
      await page.getByLabel('Confirm Password', { exact: true }).fill('Long-test-password');
      await page.getByRole('button', { name: 'Continue', exact: true }).click();
      await page.getByLabel('Test verification code digit 1 of 6', { exact: true }).fill('123456');
      await page.getByRole('button', { name: 'Continue', exact: true }).click();
      await page.getByRole('button', { name: 'Continue', exact: true }).click();
      await page.getByLabel('Full Legal Name', { exact: true }).fill('Test User');
      await page.getByRole('button', { name: 'Continue', exact: true }).click();
      await page.getByRole('button', { name: 'Continue', exact: true }).click();
      await page.getByRole('button', { name: 'Select & Continue', exact: true }).click();
      await page.getByRole('button', { name: 'Create account', exact: true }).click();
      await page.getByRole('button', { name: 'Continue to Login', exact: true }).click();
      await page.getByRole('button', { name: 'Back to Welcome', exact: true }).waitFor();
      assert.equal(await splashCount(page), 1);
      await login(page);
      assert.equal(api.loginCalls, 1);
      assert.equal(await splashCount(page), 1);
      await page.reload();
      await page.getByRole('button', { name: 'ZettaAI Assistant', exact: true }).first().waitFor();
      assert.equal(await splashCount(page), 0, 'Dashboard refresh must skip launch splash');
      await page.getByText('Transaction History', { exact: true }).first().click();
      await page.reload();
      await page.getByText(width >= 768 ? 'Complete Transaction History' : 'Transaction History', { exact: true }).waitFor();
      assert.equal(await splashCount(page), 0);
      if (width < 768) await page.getByText('<', { exact: true }).click();
      await page.getByRole('button', { name: 'ZettaAI Assistant', exact: true }).first().click();
      await page.reload();
      await page.getByTestId('ai_header_title').waitFor();
      assert.equal(await splashCount(page), 0);
      api.invalid = true; await page.reload();
      await page.getByRole('button', { name: 'Back to Welcome', exact: true }).waitFor();
      assert.equal(await page.evaluate(() => sessionStorage.getItem('zettaremit-session')), null);
      api.invalid = false; await login(page);
      if (width < 768) await page.getByText('Profile', { exact: true }).click();
      await page.getByText('Log Out', { exact: true }).click();
      await page.getByRole('button', { name: 'Back to Welcome', exact: true }).waitFor();
      assert.equal(await page.evaluate(() => sessionStorage.getItem('zettaremit-session')), null);
      await page.evaluate(() => {
        sessionStorage.setItem('zettaremit-session', JSON.stringify({ token: 'expired-synthetic-token', expiresAt: 1 }));
        sessionStorage.setItem('zettaremit-navigation', JSON.stringify({ name: 'Dashboard', params: { page: 7 } }));
      });
      await page.reload();
      await page.getByRole('button', { name: 'Back to Welcome', exact: true }).waitFor();
      assert.equal(await page.evaluate(() => sessionStorage.getItem('zettaremit-session')), null);
      assert.equal(await splashCount(page), 0);
      assert.deepEqual(api.writes, ['/users/register', '/users/login', '/users/login']);
      await page.getByRole('button', { name: 'Back to Welcome', exact: true }).click();
      await welcome(page);
      await page.getByText('Back to Homepage', { exact: false }).last().click();
      await page.reload();
      await page.getByText('A simpler way to simulate international money transfers.', { exact: true }).last().waitFor();
      assert.equal(await splashCount(page), 0, 'Homepage reload must restore Home without replaying splash');
      assert.deepEqual(await page.evaluate(() => JSON.parse(sessionStorage.getItem('zettaremit-navigation'))), { name: 'Home' });
      assert.deepEqual(errors, []);
      await context.close();
      console.log(`PASS ${width}px: fresh splash/Home, Get Started/Welcome, Back to Homepage, homepage reload, keyboard Back, signup/login, Dashboard/Transactions/AI refresh, invalid/expired session, logout, no internal splash`);
    }
    // The app restores a directly opened Login without needing a previous Welcome in its stack.
    {
      const { context, page, errors } = await setup(1280, { route: { name: 'Login' } });
      await page.goto(origin, { waitUntil: 'domcontentloaded' });
      await page.getByRole('button', { name: 'Back to Welcome', exact: true }).click();
      await welcome(page);
      assert.equal(await splashCount(page), 1);
      assert.deepEqual(errors, []); await context.close();
      console.log('PASS directly opened Login: Back goes to Welcome without app history');
    }
    {
      const { context, page, api, errors } = await setup(1280, { route: { name: 'AIAssistant' }, session: { token: 'synthetic-token', expiresAt: Date.now() + 3600000 } });
      await page.goto(origin, { waitUntil: 'domcontentloaded' });
      await page.getByTestId('ai_header_title').waitFor();
      assert.equal(await splashCount(page), 1);
      assert.deepEqual(errors, []); await context.close();
      assert(api.historyCalls >= 1, 'Fresh authenticated session must be validated');
      console.log('PASS fresh authenticated launch: splash, validated session, restored Assistant');
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
