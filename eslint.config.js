// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*'],
  },
  {
    rules: {
      // The lucide barrel re-exports all ~1,667 icons and Metro doesn't
      // tree-shake — one barrel import ships the whole catalog. Icons are
      // re-exported individually from components/ui/icons.ts; add new ones
      // there (see that file's header for the alias-name gotcha).
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'lucide-react-native',
              message:
                "Import icons from '@/components/ui/icons' instead — the barrel bundles all ~1,667 icons.",
            },
          ],
          // Top-level modules are imported via the @/ alias everywhere —
          // relative climbs to them were normalized once; keep it that way.
          patterns: [
            {
              group: [
                '../lib/*',
                '../stores/*',
                '../utils/*',
                '../types/*',
                '../constants/*',
                '../../lib/*',
                '../../stores/*',
                '../../utils/*',
                '../../types/*',
                '../../constants/*',
              ],
              message:
                "Use the '@/' alias for top-level modules (e.g. '@/lib/api').",
            },
          ],
        },
      ],
    },
  },
  {
    // Scoped to TS files — the @typescript-eslint plugin is only defined
    // for them (via eslint-config-expo).
    files: ['**/*.{ts,tsx}'],
    rules: {
      // The any count was driven from 233 to ~21 justified keepers (RN
      // FormData file descriptors, reanimated refs, cloneElement, icon
      // component props, drift-tolerant row reads). Keep new ones visible
      // in review — prefer a real contract type or `unknown` + narrowing.
      '@typescript-eslint/no-explicit-any': 'warn',
    },
  },
  {
    // Jest test files use the canonical mock idioms: a require() inside the
    // jest.mock factory (imports would be hoisted past the mock) and value
    // imports placed after the jest.mock calls. Both are correct there.
    files: ['**/__tests__/**/*.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
      'import/first': 'off',
    },
  },
]);
