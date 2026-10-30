import React, { useState } from 'react';
import { registerRootComponent } from 'expo';
import { View, Text, TouchableOpacity } from 'react-native';

// Guard before requiring DashboardScreen. Only same-origin Metro GETs/HMR are allowed.
function installNetworkGuard() {
  if (typeof window === 'undefined') return;
  // Browser-level backup also blocks redirects/connections outside this preview.
  if (window.document?.head) {
    const policy = window.document.createElement('meta');
    policy.httpEquiv = 'Content-Security-Policy';
    policy.content = "connect-src 'self' ws://localhost:8081 ws://127.0.0.1:8081 ws://[::1]:8081; form-action 'none'";
    window.document.head.appendChild(policy);
  }
  const permitted = (input, method = 'GET', socket = false) => {
    const url = new URL(input, window.location.href);
    const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
    const protocol = socket ? ['ws:', 'wss:'] : ['http:', 'https:'];
    return local && url.hostname === window.location.hostname && url.port === '8081'
      && protocol.includes(url.protocol) && !url.username && !url.password
      && ['GET', 'HEAD'].includes(String(method).toUpperCase())
      && !/^\/(users|transactions|simulation)(\/|$)/.test(url.pathname);
  };
  const denied = () => { throw new Error('Network access blocked by local dashboard preview.'); };
  const fetchOriginal = window.fetch?.bind(window);
  if (fetchOriginal) window.fetch = (input, options = {}) => {
    const url = typeof input === 'string' || input instanceof URL ? input : input.url;
    const method = options.method || input.method || 'GET';
    return permitted(url, method) ? fetchOriginal(input, { ...options, redirect: 'error' }) : Promise.reject(new Error('Network access blocked by local dashboard preview.'));
  };
  if (window.XMLHttpRequest) {
    const open = window.XMLHttpRequest.prototype.open;
    window.XMLHttpRequest.prototype.open = function(method, url, ...rest) {
      if (!permitted(url, method)) return denied();
      return open.call(this, method, url, ...rest);
    };
  }
  if (window.WebSocket) {
    const Socket = window.WebSocket;
    window.WebSocket = class extends Socket {
      constructor(url, protocols) {
        if (!permitted(url, 'GET', true)) denied();
        super(url, protocols);
      }
    };
  }
  if (window.navigator.sendBeacon) window.navigator.sendBeacon = () => false;
}
installNetworkGuard();
const DashboardScreen = require('../screens/DashboardScreen').default;

function LocalDashboardPreview() {
  const [visible, setVisible] = useState(true);
  const local = typeof window !== 'undefined'
    && ['localhost', '127.0.0.1', '[::1]'].includes(window.location.hostname)
    && window.location.port === '8081';
  if (!__DEV__ || !local) return <Text>This dashboard preview runs only in development on localhost:8081.</Text>;
  return (
    <View style={{ flex: 1 }}>
      <Text accessibilityRole="alert" style={{ padding: 8, backgroundColor: '#E8F5E9', color: '#164B25' }}>
        LOCAL VISUAL PREVIEW — fictional user, illustrative balance and mock history. All writes disabled.
      </Text>
      {visible ? <DashboardScreen navigation={{ replace: () => setVisible(false) }} /> : (
        <TouchableOpacity onPress={() => setVisible(true)} style={{ padding: 24 }}>
          <Text>Return to fictional dashboard preview</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}
registerRootComponent(LocalDashboardPreview);
