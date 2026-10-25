const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const React = require('react');
const babel = require('@babel/core');

const fixture = require('../preview/mockApi');
const { createClient } = require('../lib/client');

// ---------------------------------------------------------------------------
// TEST SUITE: CHANGE 4 — REQUIRED USER NAME DURING SIGNUP
// ---------------------------------------------------------------------------
test('RegistrationWizard requires user name and rejects empty or whitespace-only name', () => {
  const wizardSource = fs.readFileSync(path.join(__dirname, '../screens/RegistrationWizard.js'), 'utf8');
  
  // Verify validation logic in nextStep()
  assert.match(wizardSource, /if\s*\(!fullName\s*\|\|\s*!fullName\.trim\(\)\)/);
  assert.match(wizardSource, /Please enter your name\./);
  
  // Verify step 7 submission passes trimmed fullName and does NOT default to "Demo User"
  assert.match(wizardSource, /full_name:\s*fullName\.trim\(\)/);
  assert.doesNotMatch(wizardSource, /fullName\.trim\(\)\s*\|\|\s*"Demo User"/);
});

// ---------------------------------------------------------------------------
// TEST SUITE: CHANGE 5 — PERSONALIZED DASHBOARD GREETING & SESSION PERSISTENCE
// ---------------------------------------------------------------------------
test('login stores and returns full_name without password, and session preserves full_name', async () => {
  let storedSession = null;
  const storage = {
    get: async () => storedSession,
    set: async (val) => { storedSession = val; },
    clear: async () => { storedSession = null; }
  };
  const mockFetch = async () => ({
    ok: true,
    status: 200,
    json: async () => ({
      access_token: 'synthetic-jwt-token',
      expires_in: 900,
      full_name: 'Dr. Jane Smith'
    })
  });

  const client = createClient({
    baseUrl: 'https://api.example.com',
    storage,
    fetchImpl: mockFetch
  });

  const result = await client.login('jane@example.com', 'SecurePassword123!');
  assert.equal(result.full_name, 'Dr. Jane Smith');
  assert.equal(storedSession.fullName, 'Dr. Jane Smith');
  assert.equal(storedSession.token, 'synthetic-jwt-token');
  assert.equal(Object.hasOwn(storedSession, 'password'), false);

  // Client exposes session() to retrieve stored user information
  const session = await client.session();
  assert.equal(session.fullName, 'Dr. Jane Smith');

  // Client logout clears stored user info
  await client.logout();
  assert.equal(storedSession, null);
  assert.equal(await client.session(), null);
});

// ---------------------------------------------------------------------------
// TEST SUITE: CHANGE 1, 2, 3 & 5 — DASHBOARD COMPONENT CHECKS
// ---------------------------------------------------------------------------
const dashSource = fs.readFileSync(path.join(__dirname, '../screens/DashboardScreen.js'), 'utf8');
const transformedDash = babel.transformSync(dashSource, {
  babelrc: false,
  configFile: false,
  plugins: ['@babel/plugin-transform-react-jsx', '@babel/plugin-transform-modules-commonjs']
}).code;

function renderDashboard(width, step, quoteState = {}, mockSession = { fullName: 'Alexander Fleming' }) {
  let index = 0;
  const react = {
    ...React,
    useEffect: (fn, deps) => {
      // Execute mount effects synchronously for state initialization
      if (Array.isArray(deps) && deps.length === 0) {
        try { fn(); } catch (_) {}
      }
    },
    useRef: value => ({ current: value }),
    useState: initial => {
      const current = index++;
      let value = initial;
      if (current === 0) value = step;
      else if (initial && typeof initial === 'object' && 'accepted' in initial) {
        value = { ...initial, ...quoteState };
      } else if (current === 18) {
        // userName state hook
        value = mockSession?.fullName || '';
      }
      return [value, () => {}];
    }
  };

  const rn = {
    StyleSheet: { create: value => value },
    Platform: { OS: 'web' },
    useWindowDimensions: () => ({ width }),
    Linking: { openURL: async () => {} }
  };
  for (const name of ['Text', 'View', 'SafeAreaView', 'ScrollView', 'TouchableOpacity', 'TextInput', 'KeyboardAvoidingView', 'StatusBar', 'Image']) {
    rn[name] = name;
  }

  const mockApi = {
    history: async () => [],
    logout: async () => {},
    session: async () => mockSession,
    config: async () => ({ inr_per_usd: '86.50000000', fee_percent: '3' }),
    quote: async () => ({})
  };

  const moduleObj = { exports: {} };
  const imports = {
    'react': react,
    'react-native': rn,
    '../lib/api': mockApi,
    '../lib/quoteFlow': require('../lib/quoteFlow'),
    'expo-crypto': { randomUUID: () => 'uuid' }
  };

  vm.runInNewContext(transformedDash, {
    module: moduleObj,
    exports: moduleObj.exports,
    Date,
    setInterval,
    clearInterval,
    setTimeout: (fn) => fn(),
    clearTimeout: () => {},
    require: name => {
      if (name.endsWith('.png')) return 1;
      if (!imports[name]) throw Error('Unexpected import: ' + name);
      return imports[name];
    }
  });

  return moduleObj.exports.default({ navigation: { replace: () => {} } });
}

function nodes(tree) {
  if (!React.isValidElement(tree)) return [];
  return [tree, ...React.Children.toArray(tree.props.children).flatMap(nodes)];
}

function text(tree) {
  if (typeof tree === 'string' || typeof tree === 'number') return String(tree);
  return React.isValidElement(tree) ? React.Children.toArray(tree.props.children).map(text).join(' ') : '';
}

test('CHANGE 1: Root SafeAreaView constrains viewport height on web for scrolling', () => {
  const desktopRoot = renderDashboard(1280, 3);
  assert.equal(desktopRoot.type, 'SafeAreaView');
  // Root style array includes height: '100vh', maxHeight: '100vh', overflow: 'hidden'
  const styles = Array.isArray(desktopRoot.props.style) ? Object.assign({}, ...desktopRoot.props.style.filter(Boolean)) : desktopRoot.props.style;
  assert.equal(styles.height, '100vh');
  assert.equal(styles.maxHeight, '100vh');
  assert.equal(styles.overflow, 'hidden');

  const mobileRoot = renderDashboard(375, 3);
  assert.equal(mobileRoot.type, 'SafeAreaView');
  const mStyles = Array.isArray(mobileRoot.props.style) ? Object.assign({}, ...mobileRoot.props.style.filter(Boolean)) : mobileRoot.props.style;
  assert.equal(mStyles.height, '100vh');
  assert.equal(mStyles.maxHeight, '100vh');
  assert.equal(mStyles.overflow, 'hidden');
});

test('CHANGE 3: Manual "Refresh quote" / "Load quote" link is removed from rate banner', async () => {
  const quote = await fixture.quote({ recipient_name: 'Synthetic', gross_amount: '1000.00' });
  for (const width of [375, 1280]) {
    const root = renderDashboard(width, 3, { quote, accepted: true });
    const content = text(root).replace(/\s+/g, ' ');
    assert.doesNotMatch(content, /Refresh quote/);
    assert.doesNotMatch(content, /Load quote/);
    assert.doesNotMatch(content, /Latest daily USD\/INR reference rate/);
    assert.doesNotMatch(content, /Not continuously live/);
    assert.match(content, /Rates By Exchange Rate API/);
  }
});

test('CHANGE 2: Quote Banner displays 3% fee, net INR, USD payout and expiry automatically', async () => {
  const quote = await fixture.quote({ recipient_name: 'Synthetic', gross_amount: '50000.00' });
  for (const width of [375, 1280]) {
    const root = renderDashboard(width, 3, { quote, accepted: true });
    const content = text(root).replace(/\s+/g, ' ');
    assert.match(content, /3% fee: INR 1500\.00/);
    assert.match(content, /Net INR: 48500\.00/);
    assert.match(content, /USD payout: 538\.89/);
    assert.match(content, /Quote expires/);
  }
});

test('CHANGE 5: Dashboard greeting displays personalized name and falls back safely to User', () => {
  // With personalized name
  const dashWithName = renderDashboard(1280, 1, {}, { fullName: 'Alexander Fleming' });
  const contentWithName = text(dashWithName).replace(/\s+/g, ' ');
  assert.match(contentWithName, /Hi, Alexander Fleming/);
  assert.doesNotMatch(contentWithName, /Hi, demo user/);

  // With empty/missing name -> falls back safely to "Hi, User"
  const dashWithoutName = renderDashboard(1280, 1, {}, null);
  const contentWithoutName = text(dashWithoutName).replace(/\s+/g, ' ');
  assert.match(contentWithoutName, /Hi, User/);
  assert.doesNotMatch(contentWithoutName, /Hi, demo user/);
});
