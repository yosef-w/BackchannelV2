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
        },
      ],
    },
  },
]);
