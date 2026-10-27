// Regression tests for Security Audit Fixes (SEC-02 and SEC-04)
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createClient } = require('../lib/client');

test('SEC-02: RegistrationWizard eliminates raw document number input and uses fictional simulation badge', () => {
  const regSource = fs.readFileSync(path.join(__dirname, '../screens/RegistrationWizard.js'), 'utf8');

  // Verify text input for kycNumber is completely removed
  assert.doesNotMatch(regSource, /onChangeText=\{setKycNumber\}/, 'Must not allow user entry of document numbers');
  assert.doesNotMatch(regSource, /const \[kycNumber, setKycNumber\]/, 'Must not hold kycNumber state');

  // Verify explicit non-collection disclosures
  assert.match(regSource, /Assigned Test ID:/, 'Must display an assigned fictional test ID');
  assert.match(regSource, /No government ID numbers are collected or stored\./, 'Must state no government ID numbers are collected or stored');
  assert.match(regSource, /Real identity documents are not collected, verified, or stored in simulation mode\./, 'Must state documents are not verified or stored');

  // Verify registration payload sends only essential account fields (full_name, email, password)
  assert.match(regSource, /api\.register\(\{full_name: fullName\.trim\(\), email: emailPhone\.trim\(\)\.toLowerCase\(\), password\}\)/);
});

test('SEC-04: client.js handles 429 Too Many Requests cleanly on rate endpoint', async () => {
  let calls = 0;
  const client = createClient({
    baseUrl: 'https://api.example.com',
    storage: { get: async () => 'mock-token', set: async () => {}, clear: async () => {} },
    fetchImpl: async () => {
      calls++;
      return {
        ok: false,
        status: 429,
        json: async () => ({ detail: 'Too many requests; try again later' })
      };
    }
  });

  await assert.rejects(
    async () => client.rate(),
    err => {
      assert.match(err.message, /Too many attempts/i);
      return true;
    },
    'Should propagate 429 rate limit error cleanly to UI'
  );
  assert.equal(calls, 1);
});
