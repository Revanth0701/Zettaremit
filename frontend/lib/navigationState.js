const KEY = 'zettaremit-navigation';
const PUBLIC_ROUTES = ['Home', 'HowItWorks', 'RatesAndFees', 'About', 'Welcome', 'Login'];
const PRIVATE_ROUTES = ['Dashboard', 'AIAssistant'];
function safeRoute(route, authenticated) {
  if (!route || ![...PUBLIC_ROUTES, ...PRIVATE_ROUTES].includes(route.name)) return null;
  if (PRIVATE_ROUTES.includes(route.name) && !authenticated) return { name: 'Login' };
  if (route.name === 'Dashboard') return { name: 'Dashboard', params: { page: route.params?.page === 7 ? 7 : 1 } };
  return { name: route.name };
}
function readNavigation(storage, authenticated) {
  try {
    const route = safeRoute(JSON.parse(storage?.getItem(KEY)), authenticated);
    if (route) return authenticated && ['Welcome', 'Login'].includes(route.name) ? { name: 'Dashboard' } : route;
  } catch (_) {}
  return { name: authenticated ? 'Dashboard' : 'Welcome' };
}
function saveNavigation(storage, state) {
  const route = safeRoute(state?.routes?.[state.index ?? 0], true);
  try { if (route) storage?.setItem(KEY, JSON.stringify(route)); } catch (_) {}
}
// Reloads restore their page without replaying the fresh-launch splash.
function isWebRefresh(performance) {
  try { return performance?.getEntriesByType('navigation')[0]?.type === 'reload'; }
  catch (_) { return false; }
}
module.exports = { KEY, safeRoute, readNavigation, saveNavigation, isWebRefresh };
