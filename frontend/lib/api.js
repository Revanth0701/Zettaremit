import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { createClient } from './client';

let memory = null;
const listeners = new Set();
const storage = {
  async get() {
    if (Platform.OS === 'web') {
      if (!memory && typeof window !== 'undefined' && window.sessionStorage) {
        try {
          const item = window.sessionStorage.getItem('zettaremit-session');
          if (item) memory = JSON.parse(item);
        } catch (_) {}
      }
      return memory;
    }
    try { return JSON.parse(await SecureStore.getItemAsync('zettaremit-session')); }
    catch (_) { return null; }
  },
  async set(value) {
    if (Platform.OS === 'web') {
      memory = value;
      if (typeof window !== 'undefined' && window.sessionStorage) {
        try {
          if (value) window.sessionStorage.setItem('zettaremit-session', JSON.stringify(value));
          else window.sessionStorage.removeItem('zettaremit-session');
        } catch (_) {}
      }
    }
    else await SecureStore.setItemAsync('zettaremit-session', JSON.stringify(value));
  },
  async clear() {
    memory = null;
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.sessionStorage) {
        try { window.sessionStorage.removeItem('zettaremit-session'); } catch (_) {}
      }
    } else {
      await SecureStore.deleteItemAsync('zettaremit-session');
    }
  }
};
let client;
function getClient() {
  if (!client) client = createClient({
    baseUrl: process.env.EXPO_PUBLIC_API_URL || (__DEV__ ? 'http://127.0.0.1:8000' : 'https://zettaremit-app.onrender.com'),
    allowHttp: __DEV__, storage, fetchImpl: (...args) => fetch(...args),
    onUnauthorized: () => listeners.forEach(listener => listener())
  });
  return client;
}
export const onUnauthorized = listener => { listeners.add(listener); return () => listeners.delete(listener); };
export default {
  login: (...args) => getClient().login(...args),
  register: (...args) => getClient().register(...args),
  history: () => getClient().history(),
  quote: (...args) => getClient().quote(...args),
  rate: () => getClient().rate(),
  getReferenceRate: (...args) => getClient().getReferenceRate(...args),
  transfer: (...args) => getClient().transfer(...args),
  config: () => getClient().config(),
  health: (...args) => getClient().health(...args),
  wakeBackend: (...args) => getClient().wakeBackend(...args),
  aiHealth: () => getClient().aiHealth(),
  aiAsk: (...args) => getClient().aiAsk(...args),
  aiAskStream: (...args) => getClient().aiAskStream(...args),
  logout: () => getClient().logout(),
  session: () => getClient().session()
};
