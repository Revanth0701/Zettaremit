// This configuration is loaded ONLY when frontend/preview is the Expo project root.
const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');
const parent = path.resolve(__dirname, '..');
const config = getDefaultConfig(__dirname);
config.watchFolders = [...new Set([...config.watchFolders, parent])];
config.resolver.nodeModulesPaths = [path.join(parent, 'node_modules')];
const originalResolver = config.resolver.resolveRequest;
const normal = (context, name, platform) => originalResolver
  ? originalResolver(context, name, platform)
  : context.resolveRequest(context, name, platform);
config.resolver.resolveRequest = (context, name, platform) => {
  if (path.resolve(context.originModulePath) === path.join(parent, 'screens', 'DashboardScreen.js') && name === '../lib/api') {
    return { type: 'sourceFile', filePath: path.join(__dirname, 'mockApi.js') };
  }
  const result = normal(context, name, platform);
  if (result.type === 'sourceFile' && ['api.js', 'client.js'].some(file => path.resolve(result.filePath) === path.join(parent, 'lib', file))) {
    throw new Error('The production API client is forbidden in the local dashboard preview.');
  }
  return result;
};
module.exports = config;
