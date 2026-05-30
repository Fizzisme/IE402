const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const config = getDefaultConfig(projectRoot);

config.resolver.extraNodeModules = {
  '@': path.resolve(projectRoot, 'src'),
};

// Fix: ensure Metro resolves .ttf assets inside node_modules vendor folders
const defaultAssetExts = config.resolver.assetExts ?? [];
if (!defaultAssetExts.includes('ttf')) {
  config.resolver.assetExts = [...defaultAssetExts, 'ttf'];
}

// Fix: watch the @expo/vector-icons build folder so vendor assets are visible
config.watchFolders = [
  ...(config.watchFolders ?? []),
  path.resolve(projectRoot, 'node_modules/@expo/vector-icons/build'),
];

module.exports = config;
