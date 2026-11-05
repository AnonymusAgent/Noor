// The sync server is a plain Node/TypeScript package, not an Expo app, so it
// gets its own config: no React Native rules, and `process.env` is legitimate
// here (that is where server configuration comes from).
import base from 'eslint-config-expo/flat.js';

export default [
  ...base,
  {
    files: ['**/*.ts'],
    rules: {
      'expo/no-dynamic-env-var': 'off',
      'expo/no-env-var-destructuring': 'off',
    },
  },
  {
    ignores: ['dist/*', 'drizzle/*'],
  },
];
