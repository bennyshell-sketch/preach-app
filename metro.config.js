const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

const config = getDefaultConfig(__dirname);

// Supabase realtime-js ships browser-targeted ESM that Metro's default
// "exports" resolution picks up and then chokes on; force the RN condition.
config.resolver.unstable_enablePackageExports = true;
config.resolver.unstable_conditionNames = ['react-native', 'require', 'default'];

module.exports = withNativeWind(config, { input: './global.css' });
