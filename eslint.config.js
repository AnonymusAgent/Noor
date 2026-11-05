// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: [
      'dist/*',
      '.webbuild/*',
      'app-example/*',
      // Expo generates these on every `expo start` / `expo export`.
      '.expo/*',
      'expo-env.d.ts',
      // The sync API is a plain Node package with its own config
      // (`server/eslint.config.mjs`) and its own `pnpm lint:server` script.
      // Expo's rules (no dynamic process.env access, React Native patterns) do
      // not apply to a server that is configured through the environment.
      'server/**',
    ],
  },
  {
    // React Native's <Text> does not decode HTML entities, so `&apos;` /
    // `&quot;` would be rendered literally on device. Apostrophes and quotes in
    // JSX text are correct here; the rule only makes sense for the DOM.
    rules: {
      'react/no-unescaped-entities': 'off',
    },
  },
  {
    // Node scripts are CommonJS and run outside the bundler.
    files: ['scripts/**/*.cjs', 'scripts/**/*.js'],
    languageOptions: {
      sourceType: 'commonjs',
      globals: {
        __dirname: 'readonly',
        __filename: 'readonly',
        module: 'writable',
        require: 'readonly',
        process: 'readonly',
        console: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
      },
    },
  },
]);
