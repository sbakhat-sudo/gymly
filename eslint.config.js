// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*', 'coverage/*', '.expo/*'],
  },
  {
    rules: {
      // No user data in logs: use src/lib/logger instead.
      'no-console': 'error',
      // No dynamic code execution, ever.
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'no-new-func': 'error',
    },
  },
  {
    // TypeScript-only rules (the plugin is registered by eslint-config-expo for these files only).
    files: ['**/*.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/ban-ts-comment': [
        'error',
        {
          'ts-ignore': true,
          'ts-nocheck': true,
          'ts-expect-error': 'allow-with-description',
          minimumDescriptionLength: 10,
        },
      ],
    },
  },
  {
    // Demo = zero network. No fetch/XHR/WebSocket, no HTTP client, no WebView, no external browser.
    files: ['src/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-globals': [
        'error',
        { name: 'fetch', message: 'The demo makes no network calls. Go through GymlyApi.' },
        { name: 'XMLHttpRequest', message: 'The demo makes no network calls.' },
        { name: 'WebSocket', message: 'The demo makes no network calls.' },
      ],
      'no-restricted-imports': [
        'error',
        {
          paths: [
            { name: 'axios', message: 'No HTTP clients in the demo.' },
            { name: 'react-native-webview', message: 'No WebView.' },
            { name: 'expo-web-browser', message: 'No external links without validation.' },
          ],
          patterns: [
            { group: ['@/mocks/*', '**/mocks/*'], message: 'UI code must use GymlyApi, never import mocks.' },
            {
              group: ['@/lib/api/mock-api', '**/api/mock-api'],
              message: 'Only src/lib/services.ts may build the mock API.',
            },
          ],
        },
      ],
    },
  },
  {
    // The data layer itself may use the mocks (composition root + tests).
    files: ['src/lib/api/mock-api.ts', 'src/lib/services.ts', 'src/mocks/**', 'src/**/__tests__/**'],
    rules: { 'no-restricted-imports': 'off' },
  },
  {
    // The logger is the only place allowed to touch the console.
    files: ['src/lib/logger.ts'],
    rules: { 'no-console': 'off' },
  },
]);
