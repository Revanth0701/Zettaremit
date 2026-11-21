// Real rendered-UI verification. Explicitly requires --live (Gemini costs and
// synthetic inserts). No traces, HARs, tokens, passwords or request bodies saved.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const artifacts = path.join(root, '.local-backups/browser-verification');
const { chromium } = require(path.join(artifacts, 'node_modules/playwright'));
const results = [];
const secrets = [];
const remoteAttempts = [];
const consoleLeaks = [];
const pageErrors = [];
const network = [];
let stage = 'initialization';
const scrub = value => {
  let text = String(value);
  for (const secret of secrets) text = text.split(secret).join('[REDACTED]');
  return text.replace(/eyJ[\w-]+\.[\w-]+\.[\w-]+/g, '[REDACTED_TOKEN]')
    .replace(/AIza[\w-]+/g, '[REDACTED_KEY]');
};
function record(check, ok, details = {}) {
  const result = { check, result: ok ? 'PASS' : 'FAIL', ...details };
  results.push(result); console.log(JSON.stringify(result));
}
function safeText(text) {
  return !/eyJ[\w-]+\.[\w-]+\.[\w-]+|AIza[\w-]{20,}/.test(text) &&
    !secrets.some(secret => text.includes(secret));
}
async function screenshot(page, name) {
  assert(safeText(await page.locator('body').innerText()), 'Sensitive UI output; screenshot refused');
  await page.screenshot({ path: path.join(artifacts, 'screenshots', name + '.png'), fullPage: true });
}
async function configureContext(browser, viewport) {
  const context = await browser.newContext({ viewport, serviceWorkers: 'block' });
  await context.route('**/*', route => {
    const request = route.request(); const url = new URL(request.url());
    if (['127.0.0.1', 'localhost'].includes(url.hostname) && ['8000', '8081', '8082'].includes(url.port)) return route.continue();
    if (url.hostname === 'open.er-api.com' && !request.headers().authorization) return route.continue();
    if (['data:', 'blob:'].includes(url.protocol)) return route.continue();
    remoteAttempts.push(url.hostname); return route.abort();
  });
  context.on('page', page => {
    page.on('console', message => {
      if (!safeText(message.text())) consoleLeaks.push(message.type());
    });
    page.on('pageerror', error => pageErrors.push(scrub(error.message).slice(0, 250)));
    page.on('request', request => {
      const url = new URL(request.url());
      if (url.port === '8000') network.push({ method: request.method(), path: url.pathname });
    });
    page.on('dialog', dialog => dialog.dismiss());
  });
  return context;
}
async function home(page) {
  await page.goto('http://127.0.0.1:8081', { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.getByRole('button', { name: 'Get Started', exact: true }).first().waitFor({ timeout: 90000 });
}
async function register(page, number) {
  const account = { email: `browser-${crypto.randomBytes(6).toString('hex')}@example.com`,
    password: crypto.randomBytes(24).toString('base64url'), name: `Synthetic Browser ${number}` };
  secrets.push(account.password);
  await page.getByRole('button', { name: 'Get Started', exact: true }).first().click();
  await page.getByRole('button', { name: 'Sign-up', exact: true }).click();
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.getByText('Please enter your email address.', { exact: true }).waitFor();
  await page.getByPlaceholder('Enter your email address', { exact: true }).fill(account.email);
  await page.getByPlaceholder('Enter your password', { exact: true }).fill('short');
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.getByText('Password must be at least 12 characters.', { exact: true }).waitFor();
  assert.equal(await page.getByPlaceholder('Enter your password', { exact: true }).getAttribute('type'), 'password');
  await page.getByPlaceholder('Enter your password', { exact: true }).fill(account.password);
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.getByText('OTP Verification (Simulated)', { exact: true }).waitFor();
  await page.locator('input[maxlength="6"]').fill('123456');
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.getByPlaceholder('Street Address').fill('100 Synthetic Test Lane');
  await page.getByPlaceholder('City', { exact: true }).fill('Test City');
  await page.getByPlaceholder('Postal Code').fill('00000');
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.getByPlaceholder('Full Legal Name').fill(account.name);
  await page.getByPlaceholder('Date of Birth (DD/MM/YYYY)').fill('01/01/1990');
  await page.getByPlaceholder('Nationality').fill('Synthetic');
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.getByPlaceholder('Select Country').fill('India');
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.getByRole('button', { name: 'Select & Continue', exact: true }).click();
  const response = page.waitForResponse(r => r.url().endsWith('/users/register') && r.request().method() === 'POST');
  await page.getByRole('button', { name: 'Complete Demo Setup', exact: true }).click();
  assert.equal((await response).status(), 201);
  await page.getByText('Account Created', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Continue to Login', exact: true }).click();
  record('rendered_registration_and_validation_' + number, true);
  return account;
}
async function login(page, account) {
  await page.getByPlaceholder('Enter your email address', { exact: true }).fill(account.email);
  await page.getByPlaceholder('Password', { exact: true }).fill(account.password);
  const response = page.waitForResponse(r => r.url().endsWith('/users/login') && r.request().method() === 'POST');
  await page.getByRole('button', { name: 'Login', exact: true }).click();
  const result = await response; assert.equal(result.status(), 200);
  const data = await result.json(); secrets.push(data.access_token);
  account.token = data.access_token; account.owner = data.user_id;
  await page.getByText('Send Money', { exact: true }).first().waitFor();
  await page.getByText(new RegExp(account.name)).first().waitFor();
}
async function overflow(page, check) {
  const size = await page.evaluate(() => ({ width: innerWidth, scroll: document.documentElement.scrollWidth }));
  record(check, size.scroll <= size.width + 2, size);
}
async function ask(page, question, label) {
  stage = label;
  const messages = page.getByTestId('msg_assistant');
  const old = await messages.count();
  await page.evaluate(() => {
    window.__aiSizes = [];
    window.__aiObserver?.disconnect();
    window.__aiObserver = new MutationObserver(() => {
      const items = document.querySelectorAll('[data-testid="msg_assistant"]');
      const length = items[items.length - 1]?.innerText?.length || 0;
      if (length && window.__aiSizes.at(-1) !== length) window.__aiSizes.push(length);
    });
    window.__aiObserver.observe(document.body, { subtree: true, childList: true, characterData: true });
    window.__browserNativeFetch ||= window.fetch.bind(window);
    window.fetch = async (...args) => {
      const response = await window.__browserNativeFetch(...args);
      if (String(args[0]).endsWith('/ai/ask-stream')) {
        const probe = window.__aiProbe = { finished: false, chunks: 0, done: null, error: null };
        // Tee real bytes only for observation. Never replace a response, mock an
        // endpoint or retain credentials/signed drafts in the test summary.
        const reader = response.clone().body.getReader();
        (async () => {
          const decoder = new TextDecoder(); let buffer = '';
          try {
            while (true) {
              const item = await reader.read(); if (item.done) break;
              buffer += decoder.decode(item.value, { stream: true });
              let end;
              while ((end = buffer.indexOf('\n\n')) >= 0) {
                const frame = buffer.slice(0, end); buffer = buffer.slice(end + 2);
                if (!frame.startsWith('data:')) continue;
                const value = JSON.parse(frame.slice(5));
                if (value.type === 'chunk') probe.chunks++;
                if (value.type === 'error') probe.error = value.error;
                if (value.type === 'done') probe.done = { tool_calls: value.tool_calls, sources: value.sources,
                  drafts: (value.drafts || []).map(d => ({ submitted: d.submitted })) };
              }
            }
          } catch (_) { probe.error = 'SSE observation failed'; }
          finally { probe.finished = true; reader.releaseLock(); }
        })();
      }
      return response;
    };
  });
  await page.getByTestId('chat_input').fill(question);
  const response = page.waitForResponse(r => r.url().endsWith('/ai/ask-stream') && r.request().method() === 'POST', { timeout: 90000 });
  await page.getByTestId('send_button').click();
  await page.waitForFunction(() => document.querySelector('[data-testid="chat_input"]')?.readOnly === true);
  const answer = await response; assert.equal(answer.status(), 200);
  await page.waitForFunction(() => window.__aiProbe?.finished, undefined, { timeout: 90000 });
  const probe = await page.evaluate(() => window.__aiProbe);
  assert(!probe.error, probe.error || 'Agent error');
  const done = probe.done; assert(done);
  await page.waitForFunction(() => {
    const input = document.querySelector('[data-testid="chat_input"]');
    return input && !input.readOnly && !input.disabled;
  }, undefined, { timeout: 60000 });
  assert.equal(await messages.count(), old + 1);
  const text = await messages.last().innerText();
  assert(text.trim().length > 20 && safeText(text));
  const chunks = probe.chunks;
  record(label, true, { chunks, tools: done.tool_calls || 0, sources: done.sources || [] });
  return { text, done, chunks, updates: await page.evaluate(() => window.__aiSizes.length) };
}

async function main() {
  if (!process.argv.includes('--live')) throw new Error('--live required');
  fs.mkdirSync(path.join(artifacts, 'screenshots'), { recursive: true });
  const browser = await chromium.launch({ channel: 'msedge', headless: true,
    args: ['--disable-background-networking', '--disable-sync'] });
  const context = await configureContext(browser, { width: 1440, height: 1000 });
  const page = await context.newPage(); page.setDefaultTimeout(20000);
  try {
    stage = 'desktop_home'; await home(page);
    record('real_browser_available', true, { browser: 'Microsoft Edge', viewport: '1440x1000' });
    record('public_page_has_no_private_navigation', !(await page.getByLabel('ZettaAI Assistant', { exact: true }).count()));
    await screenshot(page, '01-home-desktop'); await overflow(page, 'desktop_home_overflow');
    stage = 'desktop_registration'; const a = await register(page, 1);
    stage = 'desktop_login'; await login(page, a);
    record('rendered_login_and_own_dashboard', true);
    await page.getByText(/1 USD =/).first().waitFor();
    await page.getByText('Loading history...', { exact: true }).waitFor({ state: 'hidden' });
    record('dashboard_loading_resolves', true);
    await screenshot(page, '02-dashboard-desktop'); await overflow(page, 'desktop_dashboard_overflow');
    const persisted = await page.evaluate(() => !!JSON.parse(sessionStorage.getItem('zettaremit-session') || 'null')?.token);
    await page.reload(); await page.getByText('Send Money', { exact: true }).first().waitFor();
    record('session_storage_survives_reload', persisted && await page.evaluate(() => !!JSON.parse(sessionStorage.getItem('zettaremit-session') || 'null')?.token));
    record('authenticated_dashboard_restored_after_reload', true);

    stage = 'desktop_transfer';
    await page.getByText('Send Money', { exact: true }).first().click();
    await page.getByPlaceholder('Recipient Legal Name').fill('Synthetic Browser Recipient');
    await page.getByPlaceholder('Account Number', { exact: true }).fill('0000000000');
    await page.getByPlaceholder('Routing Number (ACH / ABA)').fill('000000000');
    await page.getByPlaceholder('SWIFT Code').fill('DEMOUS00');
    await page.getByText('Save recipient and proceed', { exact: true }).click();
    const amount = page.locator('input:visible:not([readonly])').first();
    await amount.fill('0');
    const proceed = page.getByText('Proceed', { exact: true });
    record('transfer_invalid_amount_disabled', await proceed.locator('..').getAttribute('aria-disabled') === 'true');
    const quoted = page.waitForResponse(r => r.url().endsWith('/simulation/quote') && r.status() === 200);
    await amount.fill('10000');
    const quote = await (await quoted).json();
    assert.equal(quote.source_currency, 'INR'); assert.equal(quote.target_currency, 'USD');
    assert.equal(quote.fee_deducted, '300.00'); assert.equal(quote.net_amount, '9700.00');
    assert(Math.abs(Number(quote.recipient_amount) - Math.round(9700 / Number(quote.exchange_rate) * 100) / 100) < .001);
    await page.getByText(/3% fee: INR 300\.00/).waitFor();
    record('rendered_quote_fee_rate_payout', true);
    await screenshot(page, '03-quote-desktop');
    await proceed.click();
    await page.getByText('UPI ID', { exact: true }).click();
    await page.getByPlaceholder('UPI ID (e.g., username@upi)').fill('synthetic@upi');
    await page.getByText('Confirm UPI ID (Demo)', { exact: true }).click();
    const created = page.waitForResponse(r => r.url().endsWith('/transactions/create') && r.status() === 201);
    const countBefore = network.filter(r => r.path === '/transactions/create').length;
    await page.getByText('Proceed', { exact: true }).dblclick();
    const receipt = await created; const tx = (await receipt.json()).transaction;
    assert.equal(tx.status, 'SIMULATED');
    await page.getByText('Transfer Submitted', { exact: true }).waitFor();
    record('rendered_simulated_submission', (await page.locator('body').innerText()).includes('No live funds were moved'));
    record('rapid_duplicate_submission_guard', network.filter(r => r.path === '/transactions/create').length === countBefore + 1);
    await screenshot(page, '04-simulated-receipt');
    // Replay the exact request in memory; never save or display its signed quote.
    const replay = await context.request.post('http://127.0.0.1:8000/transactions/create', {
      headers: { Authorization: `Bearer ${a.token}`, 'Idempotency-Key': receipt.request().headers()['idempotency-key'] },
      data: receipt.request().postDataJSON()
    });
    record('actual_api_duplicate_is_idempotent', replay.status() === 201 && (await replay.json()).transaction.transaction_id === tx.transaction_id);
    await page.getByText('Go back to home', { exact: true }).click();
    await page.getByText('History', { exact: true }).first().click();
    await page.getByText('Synthetic Browser Recipient', { exact: false }).first().waitFor();
    record('rendered_history_contains_transfer', true);
    await screenshot(page, '05-history-desktop');

    stage = 'ai_navigation'; await page.getByLabel('ZettaAI Assistant', { exact: true }).click();
    await page.getByTestId('chat_input').waitFor();
    let aiHasAnswer = false;
    if (!process.argv.includes('--skip-ai')) {
      try {
      const knowledge = await ask(page, 'What is the ZettaRemit transfer fee, and does the simulation move real money?', 'rendered_live_knowledge_answer');
      aiHasAnswer = true;
      record('readable_knowledge_references', knowledge.done.sources.includes('fees_and_rates.md') &&
        (await page.getByTestId('msg_assistant').last().innerText()).includes('Fees and reference rates'));
      record('progressive_model_streaming', knowledge.chunks > 1 && knowledge.updates > 1,
        { chunks: knowledge.chunks, rendered_updates: knowledge.updates });
      if (!process.argv.includes('--knowledge-only')) {
      await ask(page, `Look up my latest simulated transfer, then retrieve details and the recorded status of ${tx.transaction_id}. Do not invent a pending reason.`, 'rendered_owned_transaction_status');
      await ask(page, 'Get the current indicative USD/INR reference rate and calculate the simulated USD payout for 10000 INR, showing the fee and observation time.', 'rendered_rate_and_decimal_estimate');
      const support = await ask(page, `Prepare a status_question support draft for my transaction ${tx.transaction_id}. Do not submit it.`, 'rendered_support_draft');
      record('support_not_claimed_submitted', support.done.drafts?.length > 0 && support.done.drafts.every(d => d.submitted === false) &&
        !/(?:I have|I've|successfully) submitted|your support (?:ticket|request) (?:has been|was) submitted/i.test(support.text));
      }
      await screenshot(page, '06-ai-desktop');
      } catch (error) {
        record(stage, false, { error_type: error.name, detail: scrub(error.message).slice(0, 500) });
        await screenshot(page, 'ai-provider-failure').catch(() => {});
      }
    }
    await page.setViewportSize({ width: 390, height: 844 });
    const [titleBounds, backBounds, clearBounds] = await Promise.all([
      page.getByTestId('ai_header_title').boundingBox(), page.getByLabel('Go back', {exact:true}).boundingBox(),
      page.getByTestId('clear_chat_button').boundingBox()
    ]);
    record('mobile_ai_header_controls_do_not_overlap', titleBounds && backBounds && clearBounds &&
      titleBounds.x >= backBounds.x + backBounds.width && titleBounds.x + titleBounds.width <= clearBounds.x);
    await overflow(page, 'mobile_ai_overflow');
    await screenshot(page, process.argv.includes('--skip-ai') ? '07-ai-mobile-welcome' : '07-ai-mobile');
    const scrolling = await page.evaluate(() => {
      const node = [...document.querySelectorAll('div')].find(el => el.clientHeight > 100 && el.scrollHeight > el.clientHeight + 20 && ['auto','scroll'].includes(getComputedStyle(el).overflowY));
      if (!node) return false; node.scrollTop = Math.max(1, node.scrollHeight / 2); return node.scrollTop > 0;
    });
    if (aiHasAnswer && !process.argv.includes('--knowledge-only')) record('mobile_chat_scrolling', scrolling);
    stage = 'mobile_logout';
    await page.getByLabel('Go back', { exact: true }).click();
    await page.getByText('<', { exact: true }).first().click();
    await page.getByText('Hi, ' + a.name, { exact: true }).click();
    await page.getByRole('button', { name: 'Log Out', exact: true }).click();
    await page.getByRole('button', { name: 'Login', exact: true }).waitFor();
    record('rendered_logout_clears_session', await page.evaluate(() => !sessionStorage.getItem('zettaremit-session')));

    stage = 'mobile_registration';
    await page.goto('http://127.0.0.1:8081'); await page.getByRole('button', { name: 'Get Started', exact: true }).first().waitFor();
    const b = await register(page, 2); await login(page, b);
    await screenshot(page, '08-dashboard-mobile'); await overflow(page, 'mobile_dashboard_overflow');
    await page.getByText('Transaction History', { exact: true }).first().click();
    record('second_user_ui_excludes_first_transfer', !(await page.locator('body').innerText()).includes('Synthetic Browser Recipient'));
    const history = await context.request.get('http://127.0.0.1:8000/transactions/', { headers: { Authorization: `Bearer ${b.token}` } });
    const forbidden = await context.request.get(`http://127.0.0.1:8000/transactions/?sender_id=${a.owner}`, { headers: { Authorization: `Bearer ${b.token}` } });
    record('actual_api_cross_user_isolation', history.status() === 200 && (await history.json()).length === 0 && forbidden.status() === 403);
    stage = 'mobile_transfer_quote';
    await page.getByText('<', { exact: true }).first().click();
    await page.getByText('Send Money', { exact: true }).first().click();
    await page.getByPlaceholder('Recipient Legal Name').fill('Synthetic Mobile Recipient');
    await page.getByText('Save recipient and proceed', { exact: true }).click();
    const mobileQuoteResponse = page.waitForResponse(r => r.url().endsWith('/simulation/quote') && r.status() === 200
      && Number(r.request().postDataJSON()?.gross_amount) === 12000);
    await page.locator('input:visible:not([readonly])').first().fill('12000');
    const mobileQuote = await (await mobileQuoteResponse).json();
    await page.getByText(/3% fee: INR 360\.00/).waitFor();
    record('mobile_transfer_form_and_quote', mobileQuote.source_currency === 'INR' && mobileQuote.target_currency === 'USD' && mobileQuote.fee_deducted === '360.00');
    await overflow(page, 'mobile_quote_overflow'); await screenshot(page, '10-quote-mobile');
    await page.getByText('<', { exact: true }).first().click();
    await page.getByText('<', { exact: true }).first().click();
    stage = 'expired_session_security';
    const unauth = await context.request.post('http://127.0.0.1:8000/ai/ask', { data: { question: 'my latest transfer' } });
    const invalid = await context.request.post('http://127.0.0.1:8000/ai/ask', { headers: { Authorization: 'Bearer invalid-synthetic-token' }, data: { question: 'my latest transfer' } });
    record('actual_api_missing_and_invalid_auth', unauth.status() === 401 && invalid.status() === 401);
    // Reset transfer state first: expiry must be rejected by the protected AI
    // page itself, not incidentally by a background expired-quote refresh.
    await page.reload();
    await page.getByText('Send Money', { exact: true }).first().waitFor();
    await page.getByText('Loading history...', { exact: true }).waitFor({ state: 'hidden' });
    // Advance only browser Date.now(), then use protected UI navigation.
    await page.clock.install(); await page.clock.setFixedTime(new Date(Date.now() + 16 * 60 * 1000));
    await page.getByLabel('ZettaAI Assistant', { exact: true }).click();
    await page.getByRole('button', { name: 'Login', exact: true }).waitFor();
    record('expired_session_redirects_protected_ui', await page.evaluate(() => !sessionStorage.getItem('zettaremit-session')));
    await screenshot(page, '09-expired-session-login-mobile');
    record('browser_console_contains_no_secrets', consoleLeaks.length === 0);
    record('no_production_browser_requests', remoteAttempts.length === 0, { blocked_hosts: [...new Set(remoteAttempts)] });
    record('browser_runtime_errors', pageErrors.length === 0, { errors: pageErrors });
    record('browser_uses_local_fastapi', network.some(r => r.path === '/users/login') && network.some(r => r.path === '/ai/health'));
  } catch (error) {
    record(stage, false, { error_type: error.name, detail: scrub(error.message).slice(0, 900) });
    const text = await page.locator('body').innerText().catch(() => '');
    // Save only rendered public/synthetic UI text, never input values or network bodies.
    if (safeText(text)) {
      fs.writeFileSync(path.join(artifacts, 'last-failure-ui.txt'), text);
      await screenshot(page, 'failure-' + stage).catch(() => {});
    }
  } finally {
    await browser.close();
    fs.writeFileSync(path.join(artifacts, 'browser-results.json'), JSON.stringify({ results, network,
      remote_attempts: [...new Set(remoteAttempts)], console_leaks: consoleLeaks.length, page_errors: pageErrors }, null, 2));
  }
  const failed = results.filter(r => r.result === 'FAIL').map(r => r.check);
  console.log(JSON.stringify({ passed: results.length - failed.length, failed: failed.length, failed_checks: failed }));
  process.exitCode = failed.length ? 1 : 0;
}
main().catch(error => { console.log(JSON.stringify({ fatal: error.name, detail: scrub(error.message).slice(0, 300) })); process.exitCode = 1; });
