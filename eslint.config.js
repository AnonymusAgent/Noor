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
