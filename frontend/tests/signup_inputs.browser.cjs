// Focused signup regression checks against the running Expo server; API writes are blocked.
const assert = require('node:assert/strict');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || path.resolve(__dirname, '../../.local-backups/browser-verification/node_modules/playwright'));
const origin = process.env.UX_TEST_ORIGIN || 'http://localhost:8081';
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
(async () => {
  const browser = await chromium.launch({ headless: true, channel: process.env.PLAYWRIGHT_CHANNEL || 'msedge' });
  try {
    for (const width of [1280, 390]) {
      const context = await browser.newContext({ viewport: { width, height: 900 }, permissions: ['clipboard-read', 'clipboard-write'] });
      const writes = [];
      await context.route('**/*', route => {
        const request = route.request();
        if (new URL(request.url()).origin === origin) return route.continue();
        if (request.method() === 'POST') writes.push(new URL(request.url()).pathname);
        return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
      });
      const page = await context.newPage();
      const errors = []; page.on('pageerror', error => errors.push(error.message));
      await page.goto(origin, { waitUntil: 'domcontentloaded', timeout: 90000 });
      await page.getByRole('button', { name: 'Get Started', exact: true }).first().click();
      await page.getByText('Sign-up', { exact: true }).click();
      const email = page.getByLabel('Email Address', { exact: true });
      const password = page.getByLabel('Password', { exact: true });
      const confirm = page.getByLabel('Confirm Password', { exact: true });
      for (const input of [email, password, confirm]) {
        assert.equal(await input.evaluate(element => getComputedStyle(element, '::placeholder').color), 'rgb(160, 174, 192)');
      }
      for (const name of ['Show password', 'Show confirm password']) {
        const button = page.getByRole('button', { name, exact: true });
        assert.equal(await button.locator('svg').evaluate(element => getComputedStyle(element).color), 'rgb(26, 32, 44)');
      }
      await email.fill('signup-check@example.com');
      await password.fill('Long-test-password');
      await confirm.fill('Long-test-password');
      await page.getByRole('button', { name: 'Show password', exact: true }).click();
      assert.equal(await password.evaluate(element => element.type), 'text');
      await page.getByRole('button', { name: 'Hide password', exact: true }).click();
      assert.equal(await password.evaluate(element => element.type), 'password');
      await page.getByRole('button', { name: 'Continue', exact: true }).click();
      const cell = number => page.getByLabel(`Test verification code digit ${number} of 6`, { exact: true });
      const values = () => Promise.all([1, 2, 3, 4, 5, 6].map(number => cell(number).inputValue()));
      const focused = async number => {
        for (let attempt = 0; attempt < 20; attempt++) {
          if (await cell(number).evaluate(element => element === document.activeElement)) return;
          await delay(25);
        }
        assert.fail(`OTP box ${number} did not receive focus`);
      };
      await focused(1);
      await cell(1).press('1'); await focused(2);
      await page.getByText('Verify your email', { exact: true }).click();
      assert.equal(await cell(2).evaluate(element => getComputedStyle(element).borderTopColor), 'rgb(226, 232, 240)');
      await cell(2).click(); await focused(2); await cell(2).press('2'); await focused(3);
      assert.deepEqual(await values(), ['1', '2', '', '', '', '']);
      assert.equal(await cell(3).evaluate(element => getComputedStyle(element).borderTopColor), 'rgb(0, 82, 204)');
      await cell(1).click(); await cell(1).press('9'); await focused(2);
      assert.deepEqual(await values(), ['9', '2', '', '', '', '']);
      await cell(2).press('Backspace'); await focused(2);
      assert.deepEqual(await values(), ['9', '', '', '', '', '']);
      await cell(2).press('Backspace'); await focused(1);
      assert.deepEqual(await values(), ['', '', '', '', '', '']);
      await cell(1).press('a');
      assert.equal(await cell(1).inputValue(), '');
      await page.evaluate(() => navigator.clipboard.writeText('123456'));
      await cell(1).press('Control+v'); await focused(6);
      assert.deepEqual(await values(), ['1', '2', '3', '4', '5', '6']);
      await cell(6).click(); await cell(6).press('9');
      assert.equal(await cell(6).inputValue(), '9');
      // Replacing any digit retains its neighbours, including after leaving the inputs.
      await page.getByText('Verify your email', { exact: true }).click();
      await cell(4).click(); await cell(4).press('8'); await focused(5);
      assert.deepEqual(await values(), ['1', '2', '3', '8', '5', '9']);
      await cell(5).press('ArrowLeft'); await focused(4);
      await cell(4).press('ArrowRight'); await focused(5);
      await cell(5).press('Shift+Tab'); await focused(4);
      await cell(4).press('Tab'); await focused(5);
      // Full-code paste from a populated middle box also replaces all six digits.
      await page.evaluate(() => navigator.clipboard.writeText('654321'));
      await cell(3).click(); await cell(3).press('Control+v'); await focused(6);
      assert.deepEqual(await values(), ['6', '5', '4', '3', '2', '1']);
      await cell(6).press('Backspace');
      await page.getByRole('button', { name: 'Continue', exact: true }).click();
      await page.getByText('Enter a 6-digit test code.', { exact: true }).waitFor();
      await cell(6).click(); await cell(6).press('1');
      await page.getByRole('button', { name: 'Continue', exact: true }).click();
      await page.getByText('Home address', { exact: true }).waitFor();
      assert.deepEqual(errors, []);
      assert.deepEqual(writes, []);
      console.log(`PASS ${width}px: placeholder/icon colors, visibility, OTP blur/refocus, advance, edit, backspace, paste, numeric filtering, keyboard navigation, unchanged validation`);
      await context.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
