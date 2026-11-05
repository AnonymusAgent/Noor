// https://docs.expo.dev/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// ── Resolver ───────────────────────────────────────────────────────────────────
// Ensure all common source extensions are included, including .cjs used by
// several Expo packages. Keep the default list and just extend it.
config.resolver = {
  ...config.resolver,
  sourceExts: [
    ...new Set([
      ...((config.resolver || {}).sourceExts || []),
      'js', 'jsx', 'ts', 'tsx', 'json', 'cjs', 'mjs',
    ]),
  ],
};

// ── Transformer ────────────────────────────────────────────────────────────────
// On RN 0.79.x, Metro's cold-cache rebuild tries to parse Flow-annotated
// internal files (Performance.js, AppRegistry.js, etc.) with hermes-parser,
// which rejects Flow type syntax.  Expo's default babel-transformer handles
// stripping Flow types before Hermes sees the AST; we just need to make sure
// nothing overrides that pipeline.
config.transformer = {
  ...config.transformer,
  // Keep Expo's default babel transformer so it strips Flow annotations first.
  babelTransformerPath: require.resolve(
    '@expo/metro-config/build/babel-transformer'
  ),
};

module.exports = config;
