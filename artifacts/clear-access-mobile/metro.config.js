const path = require('node:path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
const queryStringInteropPath = path.resolve(__dirname, 'lib/query-string-interop.ts');

config.resolver.resolveRequest = (context, moduleName, platform) => {
  const originPath = context.originModulePath.replaceAll('\\', '/');
  const isExpoRouterModule = originPath.includes('/node_modules/expo-router/');

  if (moduleName === 'query-string' && isExpoRouterModule) {
    return {
      filePath: queryStringInteropPath,
      type: 'sourceFile',
    };
  }

  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
