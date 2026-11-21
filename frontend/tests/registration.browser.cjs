// Real local auth across clean browser sessions. API requests use disposable SQLite,
// never the running development database or production. No financial writes are allowed.
const assert = require('node:assert/strict');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || path.resolve(__dirname, '../../.local-backups/browser-verification/node_modules/playwright'));
const root = path.resolve(__dirname, '../..');
const origin = 'http://localhost:8081';
const fixture = 'http://127.0.0.1:8011';
const password = 'Synthetic-original-password';
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
async function startFixture() {
  const process = spawn('python', ['backend/test_registration_offline.py', '--serve'], { cwd: root, windowsHide: true, stdio: 'ignore' });
  try {
    for (let attempt = 0; attempt < 80; attempt++) {
      if (process.exitCode !== null) throw new Error('Disposable backend exited before startup');
      try { const response = await fetch(fixture + '/health'); if (response.ok) return process; } catch (_) {}
      await pause(200);
    }
    throw new Error('Disposable backend startup timed out');
  } catch (error) { process.kill(); throw error; }
}
async function stopFixture(process) {
  if (process.exitCode !== null) return;
  const exited = new Promise(resolve => process.once('exit', resolve)); process.kill(); await exited;
}
(async () => {
  const browser = await chromium.launch({ headless: true, channel: process.env.PLAYWRIGHT_CHANNEL || 'msedge' });
  try {
    for (const width of [1280, 390]) {
      const server = await startFixture();
      const contexts = [];
      try {
        const errors = [], unexpected = [];
        async function device() {
          const context = await browser.newContext({ viewport: { width, height: 900 } });
          contexts.push(context);
          const control = { failNext: false, legacyNext: false };
          await context.route('**/*', async route => {
            const request = route.request(), url = new URL(request.url());
            if (url.origin === origin) return route.continue();
            if (url.origin !== 'http://127.0.0.1:8000') { unexpected.push(url.origin); return route.abort(); }
            if (url.pathname === '/users/register' && control.failNext) {
              control.failNext = false;
              return route.fulfill({ status: 500, contentType: 'application/json', body: '{"detail":"synthetic-private-driver-detail"}' });
            }
            if (url.pathname === '/users/register' && control.legacyNext) {
              control.legacyNext = false;
              return route.fulfill({ status: 201, contentType: 'application/json', body: '{"message":"Generic eligibility response"}' });
            }
            if (['/health', '/users/register', '/users/login', '/transactions/'].includes(url.pathname)) {
              const response = await route.fetch({ url: fixture + url.pathname });
              return route.fulfill({ response });
            }
            if (['/simulation/rate', '/simulation/config', '/ai/health'].includes(url.pathname)) return route.fulfill({ status: 503, contentType: 'application/json', body: '{}' });
            unexpected.push(url.pathname); return route.abort();
          });
          const page = await context.newPage(); page.on('pageerror', error => errors.push(error.message));
          await page.goto(origin, { waitUntil: 'domcontentloaded', timeout: 90000 });
          await page.getByRole('button', { name: 'Sign-up', exact: true }).waitFor();
          return { context, page, control };
        }
        async function signup(page, secret = password) {
          await page.getByRole('button', { name: 'Sign-up', exact: true }).click();
          await page.getByLabel('Email Address', { exact: true }).fill('browser@example.com');
          await page.getByLabel('Password', { exact: true }).fill(secret);
          await page.getByLabel('Confirm Password', { exact: true }).fill(secret);
          await page.getByRole('button', { name: 'Continue', exact: true }).click();
          await page.getByLabel('Test verification code digit 1 of 6', { exact: true }).fill('123456');
          await page.getByRole('button', { name: 'Continue', exact: true }).click();
          await page.getByRole('button', { name: 'Continue', exact: true }).click();
          await page.getByLabel('Full Legal Name', { exact: true }).fill('Synthetic Browser');
          await page.getByRole('button', { name: 'Continue', exact: true }).click();
          await page.getByRole('button', { name: 'Continue', exact: true }).click();
          await page.getByRole('button', { name: 'Select & Continue', exact: true }).click();
        }
        async function login(page) {
          await page.getByLabel('Email Address', { exact: true }).fill('browser@example.com');
          await page.getByLabel('Password', { exact: true }).fill(password);
          await page.getByRole('button', { name: 'Login', exact: true }).click();
          await page.getByRole('button', { name: 'ZettaAI Assistant', exact: true }).first().waitFor();
        }
        const first = await device();
        await signup(first.page);
        first.control.failNext = true;
        await first.page.getByRole('button', { name: 'Create account', exact: true }).click();
        await first.page.getByText('Unable to create your account right now. Please try again.', { exact: true }).waitFor();
        assert.equal(await first.page.getByText('Account Created', { exact: true }).count(), 0);
        assert(!await first.page.locator('body').innerText().then(text => text.includes('synthetic-private-driver-detail')));
        // Navigate back through the existing wizard to verify all credentials survived failure.
        for (let index = 0; index < 6; index++) await first.page.getByText(String.fromCharCode(8592), { exact: true }).click();
        assert.equal(await first.page.getByLabel('Email Address', { exact: true }).inputValue(), 'browser@example.com');
        assert.equal(await first.page.getByLabel('Password', { exact: true }).inputValue(), password);
        assert.equal(await first.page.getByLabel('Confirm Password', { exact: true }).inputValue(), password);
        for (let index = 0; index < 6; index++) await first.page.getByRole('button', { name: index === 5 ? 'Select & Continue' : 'Continue', exact: true }).click();
        // The legacy false-success response must also stay on the signup step.
        first.control.legacyNext = true;
        await first.page.getByRole('button', { name: 'Create account', exact: true }).click();
        await first.page.getByText('Account creation was not confirmed. Please try again.', { exact: true }).waitFor();
        assert.equal(await first.page.getByText('Account Created', { exact: true }).count(), 0);
        await first.page.getByRole('button', { name: 'Retry registration', exact: true }).click();
        await first.page.getByText('Account Created', { exact: true }).waitFor();
        await first.page.getByRole('button', { name: 'Continue to Login', exact: true }).click();
        await login(first.page);
        const second = await device();
        assert.equal(await second.page.evaluate(() => sessionStorage.getItem('zettaremit-session')), null);
        await second.page.getByRole('button', { name: 'Login', exact: true }).click();
        await login(second.page);
        const duplicate = await device();
        await signup(duplicate.page, 'Synthetic-different-password');
        await duplicate.page.getByRole('button', { name: 'Create account', exact: true }).click();
        await duplicate.page.getByText('This email is already registered. Please sign in or reset your password.', { exact: true }).waitFor();
        assert.equal(await duplicate.page.getByText('Account Created', { exact: true }).count(), 0);
        await duplicate.page.getByRole('button', { name: 'Sign in to existing account', exact: true }).click();
        await login(duplicate.page);
        assert.deepEqual(errors, []); assert.deepEqual(unexpected, []);
        console.log(`PASS ${width}px: safe 5xx/retry, retained values, legacy 201 rejected, real 201 signup, login in two independent sessions, duplicate 409/Sign in, original password preserved`);
      } finally { for (const context of contexts) await context.close(); await stopFixture(server); }
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
