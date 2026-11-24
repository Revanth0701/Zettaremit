const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const React = require('react');
const babel = require('@babel/core');

function harness(file, platform) {
  const states = [], refs = [];
  let cursor = 0, refCursor = 0;
  const react = { ...React,
    useState(initial) {
      const index = cursor++;
      if (!(index in states)) states[index] = typeof initial === 'function' ? initial() : initial;
      return [states[index], value => { states[index] = typeof value === 'function' ? value(states[index]) : value; }];
    },
    useRef(initial) { const index = refCursor++; return refs[index] ||= { current: initial }; },
    useEffect() {},
  };
  const rn = { Platform: { OS: platform }, StyleSheet: { create: styles => styles }, useWindowDimensions: () => ({ width: 390 }) };
  for (const name of ['Text', 'TextInput', 'TouchableOpacity', 'View', 'SafeAreaView', 'KeyboardAvoidingView', 'ScrollView', 'Image', 'ActivityIndicator']) rn[name] = name;
  const imports = { react, 'react-native': rn, '../lib/api': {}, '../components/FormFields': { PasswordField: 'PasswordField' }, '../components/CountrySelect': () => null, '../lib/readiness': {} };
  const module = { exports: {} };
  const code = babel.transformSync(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), { babelrc: false, configFile: false, plugins: [require.resolve('@babel/plugin-transform-react-jsx'), require.resolve('@babel/plugin-transform-modules-commonjs')] }).code;
  vm.runInNewContext(code, { module, exports: module.exports, require: name => {
    if (name.endsWith('.png')) return 1;
    if (!(name in imports)) throw new Error('Unexpected dependency: ' + name);
    return imports[name];
  } });
  return { exports: module.exports, states, api: imports['../lib/api'], render(Component, props = {}) { cursor = refCursor = 0; return Component(props); } };
}

for (const platform of ['web', 'ios', 'android']) {
  test(`${platform}: signup submits canonical email and exact password after changing steps`, async () => {
    const h = harness('screens/RegistrationWizard.js', platform);
    const password = ` ${require('node:crypto').randomBytes(16).toString('hex')}\u00e9 `;
    const render = () => nodes(h.render(h.exports.default, { navigation: {} }));
    let fields = render().filter(node => ['TextInput', 'PasswordField'].includes(node.type));
    fields[0].props.onChangeText('  CROSS.CLIENT@EXAMPLE.COM  ');
    fields[1].props.onChangeText(password);
    fields[2].props.onChangeText(password);
    const button = label => render().find(node => node.type === 'TouchableOpacity' &&
      nodes(node).some(child => child.type === 'Text' && child.props.children === label));
    await button('Continue').props.onPress();
    assert.equal(h.states[1], 2);
    h.states[1] = 4;
    render().find(node => node.props.accessibilityLabel === 'Full Legal Name').props.onChangeText('Synthetic');
    h.states[1] = 7;
    let submitted;
    h.api.register = async body => { submitted = body; };
    await button('Create account').props.onPress();
    assert.ok(submitted.email === 'cross.client@example.com');
    assert.ok(submitted.password === password, 'Wizard must preserve password bytes between steps');
    assert.equal(h.states[1], 8);
    h.states[1] = 1;
    fields = render().filter(node => node.type === 'PasswordField');
    assert.ok(fields.every(field => field.props.value === ''), 'Successful signup clears both password fields');
  });

  test(`${platform}: signup and login expose autofill hints only on web`, () => {
    for (const [file, expected] of [
      ['screens/RegistrationWizard.js', [['email', 'username'], ['new-password', 'new-password'], ['confirm-password', 'new-password']]],
      ['screens/LoginScreen.js', [['email', 'username'], ['password', 'current-password']]],
    ]) {
      const h = harness(file, platform);
      const fields = nodes(h.render(h.exports.default, { navigation: {} }))
        .filter(node => ['TextInput', 'PasswordField'].includes(node.type));
      assert.equal(fields.length, expected.length);
      fields.forEach((field, index) => {
        assert.equal(field.props.name, platform === 'web' ? expected[index][0] : undefined);
        assert.equal(field.props.autoComplete, platform === 'web' ? expected[index][1] : undefined);
        if (platform === 'web') {
          // React Native Web 0.21 filters the name prop; the DOM ref must set it.
          let attribute;
          field.props.ref({ setAttribute: (key, value) => { attribute = [key, value]; } });
          assert.deepEqual(attribute, ['name', expected[index][0]]);
          field.props.ref(null);
        } else {
          assert.equal(field.props.ref, undefined);
        }
        if (field.type === 'PasswordField') {
          const helper = harness('components/FormFields.js', platform);
          const input = nodes(helper.render(helper.exports.PasswordField, field.props)).find(node => node.type === 'TextInput');
          assert.equal(input.props.name, field.props.name);
          assert.equal(input.props.autoComplete, field.props.autoComplete);
          assert.equal(input.props.secureTextEntry, true);
        }
      });
    }
  });
}
function nodes(tree) {
  return React.isValidElement(tree) ? [tree, ...React.Children.toArray(tree.props.children).flatMap(nodes)] : [];
}
for (const platform of ['ios', 'android']) {
  test(`${platform}: OTP inputs preserve digit positions, focus, deletion, numeric filtering and whole-digit editing`, () => {
    const h = harness('screens/RegistrationWizard.js', platform);
    h.render(h.exports.default, { navigation: {} }); h.states[1] = 2;
    let focused, selection;
    const render = () => {
      const inputs = nodes(h.render(h.exports.default, { navigation: {} })).filter(node => node.type === 'TextInput');
      assert.equal(inputs.length, 6);
      inputs.forEach((input, index) => input.props.ref({ focus() { focused = index; input.props.onFocus(); }, setNativeProps(value) { selection = value.selection; } }));
      return inputs;
    };
    let inputs = render();
    inputs[4].props.onChangeText('7');
    assert.equal(focused, 5);
    inputs = render();
    assert.deepEqual(inputs.map(node => node.props.value), ['', '', '', '', '7', '']);
    inputs[5].props.onKeyPress({ nativeEvent: { key: 'Backspace' } });
    assert.equal(focused, 4);
    inputs = render();
    assert.equal(inputs[4].props.value, '');
    inputs[2].props.onChangeText('123456');
    inputs = render();
    assert.deepEqual(inputs.map(node => node.props.value), ['1', '2', '3', '4', '5', '6']);
    inputs[0].props.onChangeText('x');
    inputs = render(); assert.equal(inputs[0].props.value, '1');
    inputs[5].props.onSelectionChange({ nativeEvent: { selection: { start: 1, end: 1 } } });
    assert.equal(selection.start, 0); assert.equal(selection.end, 1);
    inputs[5].props.onChangeText('9');
    inputs = render(); assert.equal(inputs[5].props.value, '9');
  });
  test(`${platform}: password placeholder and eye vectors use the requested colors`, () => {
    const h = harness('components/FormFields.js', platform);
    const password = h.render(h.exports.PasswordField, { label: 'Confirm Password', placeholder: 'Re-enter your password' });
    const input = nodes(password).find(node => node.type === 'TextInput');
    assert.equal(input.props.placeholderTextColor, '#A0AEC0');
    assert.equal(input.props.secureTextEntry, true);
    const icon = h.render(h.exports.FormIcon, { kind: 'eye' });
    assert.equal(icon.props.style.borderColor, '#1A202C');
    assert.equal(nodes(icon)[1].props.style.backgroundColor, '#1A202C');
  });
}
