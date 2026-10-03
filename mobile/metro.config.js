const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

const config = getDefaultConfig(__dirname);

config.resolver.unstable_enablePackageExports = true;
config.resolver.unstable_conditionsByPlatform =
  config.resolver.unstable_conditionsByPlatform || {};
config.resolver.unstable_conditionsByPlatform.web =
  config.resolver.unstable_conditionsByPlatform.web || [];
if (!config.resolver.unstable_conditionsByPlatform.web.includes('react-native-web')) {
  config.resolver.unstable_conditionsByPlatform.web.push('react-native-web');
}

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (
    (platform === 'web' &&
      (moduleName === '@powersync/react-native' || moduleName === '@op-engineering/op-sqlite')) ||
    (platform !== 'web' && moduleName === '@powersync/web')
  ) {
    return { type: 'empty' };
  }

  return context.resolveRequest(context, moduleName, platform);
};

module.exports = withNativeWind(config, { input: './global.css' });
