// Local exported-web checks with synthetic API responses. No backend writes or model calls.
const assert = require('node:assert/strict');
const path = require('node:path');
// Set PLAYWRIGHT_MODULE when Playwright is installed outside the repository.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || path.resolve(__dirname, '../../.local-backups/browser-verification/node_modules/playwright'));
const origin = process.env.UX_TEST_ORIGIN || 'http://127.0.0.1:8091';
(async () => {
  const browser = await chromium.launch({ headless: true, channel: process.env.PLAYWRIGHT_CHANNEL || 'msedge' });
  try {
    for (const width of [1280, 390]) {
      const context = await browser.newContext({ viewport: { width, height: 900 } });
      let invalid = false;
      let registration;
      await context.route('**/*', route => {
        const url = new URL(route.request().url());
        if (url.origin === origin) return route.continue();
        let body = {};
        let status = 200;
        if (url.pathname === '/transactions/') { body = []; if (invalid) status = 401; }
        if (url.pathname === '/health') body = { status: 'ok' };
        if (url.pathname === '/users/register') { registration = route.request().postDataJSON(); body = { status: 'created', message: 'Account created. Please sign in.' }; status = 201; }
        if (url.pathname === '/users/login') body = { access_token: 'synthetic-token', expires_in: 3600, full_name: 'Test User' };
        if (url.pathname === '/simulation/rate') body = { inr_per_usd: '84.50000000', observed_at: new Date().toISOString() };
        return route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
      });
      const page = await context.newPage();
      const errors = []; page.on('pageerror', error => errors.push(error.message));
      await page.goto(origin);
      await page.getByRole('button', { name: 'Get Started', exact: true }).first().click();
      await page.getByText('Sign-up', { exact: true }).click();
      await page.getByLabel('Email Address', { exact: true }).fill('test@example.com');
      const password = page.getByLabel('Password', { exact: true });
      const confirm = page.getByLabel('Confirm Password', { exact: true });
      assert.equal(await password.evaluate(element => element.type), 'password');
      assert.equal(await confirm.evaluate(element => element.type), 'password');
      await password.fill('Long-test-password'); await confirm.fill('wrong-password');
      await page.getByRole('button', { name: 'Show password', exact: true }).click();
      assert.equal(await password.evaluate(element => element.type), 'text');
      await page.getByRole('button', { name: 'Show confirm password', exact: true }).click();
      assert.equal(await confirm.evaluate(element => element.type), 'text');
      await page.getByRole('button', { name: 'Continue', exact: true }).click();
      await page.getByText('Passwords do not match. Re-enter your confirm password.', { exact: true }).waitFor();
      await confirm.fill('Long-test-password');
      await page.getByRole('button', { name: 'Continue', exact: true }).click();
      await page.getByLabel('Test verification code digit 1 of 6', { exact: true }).fill('123456');
      await page.getByRole('button', { name: 'Continue', exact: true }).click();
      await page.getByRole('button', { name: 'Continue', exact: true }).click();
      await page.getByLabel('Full Legal Name', { exact: true }).fill('Test User');
      await page.getByRole('button', { name: 'Continue', exact: true }).click();
      await page.getByRole('button', { name: 'Country of residence: Select country', exact: true }).click();
      await page.getByLabel('Search countries by name or code').fill('no-country-matches-this');
      await page.getByText('No countries found. Try a country name or two-letter code.', { exact: true }).waitFor();
      await page.getByLabel('Search countries by name or code').fill('Canada');
      await page.getByLabel('Country results').focus();
      await page.getByLabel('Country results').press('Home');
      await page.getByLabel('Country results').press('ArrowDown');
      await page.getByRole('button', { name: 'Country of residence: Canada', exact: true }).waitFor();
      await page.getByRole('button', { name: 'Clear country selection', exact: true }).click();
      await page.getByRole('button', { name: 'Country of residence: Select country', exact: true }).click();
      await page.getByLabel('Search countries by name or code').fill('India');
      await page.getByLabel('Country results').selectOption({ label: 'India' });
      await page.getByRole('button', { name: 'Country of residence: India', exact: true }).waitFor();
      await page.getByRole('button', { name: 'Continue', exact: true }).click();
      await page.getByRole('radio', { name: 'Passport', exact: true }).click();
      assert.equal(await page.getByRole('radio', { name: 'Passport', exact: true }).getAttribute('aria-checked'), 'true');
      assert(await page.getByRole('radio', { name: 'Passport', exact: true }).locator('svg').count());
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      await page.getByRole('button', { name: 'Select & Continue', exact: true }).click();
      await page.getByRole('button', { name: 'Create account', exact: true }).click();
      await page.getByRole('button', { name: 'Continue to Login', exact: true }).click();
      assert.deepEqual(Object.keys(registration).sort(), ['email', 'full_name', 'password']);
      await page.getByLabel('Email Address', { exact: true }).fill('test@example.com');
      assert.equal(await page.getByLabel('Password', { exact: true }).evaluate(element => element.type), 'password');
      await page.getByRole('button', { name: 'Show password', exact: true }).click();
      assert.equal(await page.getByLabel('Password', { exact: true }).evaluate(element => element.type), 'text');
      await page.getByLabel('Password', { exact: true }).fill('Long-test-password');
      await page.getByRole('button', { name: 'Login', exact: true }).click();
      await page.getByRole('button', { name: 'ZettaAI Assistant', exact: true }).first().waitFor();
      await page.reload();
      await page.getByRole('button', { name: 'ZettaAI Assistant', exact: true }).first().waitFor();
      await page.getByText('Transaction History', { exact: true }).first().click();
      await page.reload();
      await page.getByText(width >= 768 ? 'Complete Transaction History' : 'Transaction History', { exact: true }).waitFor();
      // Test assistant restoration from its actual navigation entry point.
      if (width < 768) await page.getByText('<', { exact: true }).click();
      await page.getByRole('button', { name: 'ZettaAI Assistant', exact: true }).first().click();
      await page.getByText('Hi! I can help with your transactions, transfer estimates, fees, and ZettaRemit questions. How can I help?', { exact: true }).waitFor();
      await page.reload();
      await page.getByText('Hi! I can help with your transactions, transfer estimates, fees, and ZettaRemit questions. How can I help?', { exact: true }).waitFor();
      invalid = true; await page.reload();
      await page.getByRole('button', { name: 'Login', exact: true }).waitFor();
      assert.equal(await page.evaluate(() => sessionStorage.getItem('zettaremit-session')), null);
      invalid = false;
      await page.getByLabel('Email Address', { exact: true }).fill('test@example.com');
      await page.getByLabel('Password', { exact: true }).fill('Long-test-password');
      await page.getByRole('button', { name: 'Login', exact: true }).click();
      await page.getByRole('button', { name: 'ZettaAI Assistant', exact: true }).first().waitFor();
      assert(!await page.evaluate(() => JSON.stringify(sessionStorage).includes('Long-test-password')));
      if (width < 768) await page.getByText('Profile', { exact: true }).click();
      await page.getByText('Log Out', { exact: true }).click();
      await page.getByRole('button', { name: 'Login', exact: true }).waitFor();
      assert.equal(await page.evaluate(() => sessionStorage.getItem('zettaremit-session')), null);
      await page.reload();
      await page.getByRole('button', { name: 'Login', exact: true }).waitFor();
      // A locally expired token must also return to Login before protected content renders.
      await page.evaluate(() => {
        sessionStorage.setItem('zettaremit-session', JSON.stringify({ token: 'expired-synthetic-token', expiresAt: 1 }));
        sessionStorage.setItem('zettaremit-navigation', JSON.stringify({ name: 'AIAssistant' }));
      });
      await page.reload();
      await page.getByRole('button', { name: 'Login', exact: true }).waitFor();
      assert.equal(await page.evaluate(() => sessionStorage.getItem('zettaremit-session')), null);
      assert.deepEqual(errors, []);
      console.log(`PASS ${width}px: signup, password controls, country, KYC, login, refresh, invalid/expired sessions, logout`);
      await context.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
