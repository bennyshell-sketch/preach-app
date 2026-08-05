// ESLint 9 flat config.
const expoConfig = require('eslint-config-expo/flat');

module.exports = [
  ...expoConfig,
  {
    // Build scripts run in Node, not in the React Native runtime.
    files: ['scripts/**/*.{ts,mjs,js}'],
    languageOptions: {
      globals: { Buffer: 'readonly', process: 'readonly', console: 'readonly' },
    },
  },
  {
    ignores: [
      'dist/*',
      // Third-party corpora downloaded by the ingest pipeline.
      'scripts/ingest/.cache/**',
      'node_modules/*',
      // Deno runtime — different globals and module resolution than the app.
      'supabase/functions/**',
      '.expo/*',
    ],
  },
];
