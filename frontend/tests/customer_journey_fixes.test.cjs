// Unit tests for Customer Journey Audit Fixes
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createClient } = require('../lib/client');

test('LoginScreen displays "Email Address" and does not reference phone numbers', () => {
  const loginSource = fs.readFileSync(path.join(__dirname, '../screens/LoginScreen.js'), 'utf8');
  assert.match(loginSource, /<Text style=\{styles\.inputLabel\}>Email Address<\/Text>/);
  assert.doesNotMatch(loginSource, /Email Address\/Phone Number/);
  assert.match(loginSource, /placeholder="Enter your email address"/);
  assert.doesNotMatch(loginSource, /placeholder="Email\/Phone"/);
});

test('RegistrationWizard displays "Email Address", "Enter your email address", and accurate simulation copy', () => {
  const regSource = fs.readFileSync(path.join(__dirname, '../screens/RegistrationWizard.js'), 'utf8');
  
  // Email only
  assert.match(regSource, /placeholder="Enter your email address"/);
  assert.doesNotMatch(regSource, /Email address or mobile number/);
  assert.match(regSource, /Please enter your email address\./);
  assert.doesNotMatch(regSource, /Please enter your email or mobile number\./);
  
  // OTP simulation disclosure
  assert.match(regSource, /OTP Verification \(Simulated\)/);
  assert.match(regSource, /Simulation mode: No SMS is delivered\./);
  assert.doesNotMatch(regSource, /Enter the 6-digit verification code sent to your mobile number/);
  
  // Identity simulation disclosure
  assert.match(regSource, /Select document type \(Simulated Demo\)/);
  assert.match(regSource, /Demo mode: Do not enter real government document numbers\./);
  assert.match(regSource, /Photo upload \(Optional \/ Disabled in simulation\)/);
  assert.match(regSource, /Complete Demo Setup/);
  assert.doesNotMatch(regSource, /Submit & Verify/);
});

test('DashboardScreen displays data-driven exchange rate and account activity without hardcoded balance', () => {
  const dashSource = fs.readFileSync(path.join(__dirname, '../screens/DashboardScreen.js'), 'utf8');
  
  // Hardcoded balance removed
  assert.doesNotMatch(dashSource, /16,87,663/);
  assert.doesNotMatch(dashSource, /<Text style=\{styles\.balanceLabel\}>Available Balance<\/Text>/);
  assert.doesNotMatch(dashSource, /<Text style=\{styles\.balanceLabel\}>Simulated Demo Balance<\/Text>/);
  
  // Data-driven rate and activity present
  assert.match(dashSource, /INR → USD Reference Rate/);
  assert.match(dashSource, /Account Activity \(Simulated\)/);
  assert.match(dashSource, /No transfers yet\. Start your first transfer to see your activity here\./);
  
  // UPI confirmation label
  assert.match(dashSource, /Confirm UPI ID \(Demo\)/);
  assert.match(dashSource, /UPI ID Confirmed \(Simulated\)/);
  assert.doesNotMatch(dashSource, /UPI ID Verified/);
  
  // Bank transfer description
  assert.match(dashSource, /Simulated transfer via Indian net banking/);
  assert.doesNotMatch(dashSource, /Direct transfer from linked bank account/);
  
  // Bank details note & button
  assert.match(dashSource, /Demo Mode: Use fictional test bank details\./);
  assert.match(dashSource, /Confirm Simulated Transfer \(₹ \{formatNum\(rawInr\)\}\)/);
  assert.doesNotMatch(dashSource, /Pay ₹ \{formatNum\(rawInr\)\} Securely/);
});

test('DashboardScreen provides functional mobile logout mechanism', () => {
  const dashSource = fs.readFileSync(path.join(__dirname, '../screens/DashboardScreen.js'), 'utf8');
  
  // Mobile Profile tab opens profile modal
  assert.match(dashSource, /setShowProfileModal\(true\)/);
  
  // Modal provides Log Out action that calls api.logout() and redirects to Login
  assert.match(dashSource, /handleLogout/);
  assert.match(dashSource, /await api\.logout\(\)/);
  assert.match(dashSource, /navigation\.replace\('Login'\)/);
});

test('Protected routes reject requests when session is logged out or expired', async () => {
  let unauthorizedFired = false;
  let storedSession = null;
  const storage = {
    get: async () => storedSession,
    set: async (val) => { storedSession = val; },
    clear: async () => { storedSession = null; }
  };

  const client = createClient({
    baseUrl: 'https://api.example.com',
    storage,
    fetchImpl: async () => ({ ok: false, status: 401, json: async () => ({ detail: 'Unauthorized' }) }),
    onUnauthorized: () => { unauthorizedFired = true; }
  });

  // 1. Logged out user (no token in storage)
  await client.logout();
  assert.equal(storedSession, null);
  
  await assert.rejects(
    async () => client.history(),
    err => err.message === 'Please sign in again.'
  );
  assert.equal(unauthorizedFired, true);

  // 2. Expired session
  unauthorizedFired = false;
  storedSession = { token: 'expired-jwt', expiresAt: Date.now() - 5000 };
  
  await assert.rejects(
    async () => client.history(),
    err => err.message === 'Please sign in again.'
  );
  assert.equal(unauthorizedFired, true);
  assert.equal(storedSession, null);
});
