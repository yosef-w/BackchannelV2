// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    // .expo/ holds generated router types and Metro's static error overlay
    // scaffolding; neither is ours to lint.
    ignores: ['dist/*', '.expo/*'],
  },
  {
    rules: {
      // eslint-config-expo 57 promotes the React Compiler rules to errors.
      // The app already compiles under the React Compiler (which bails out of
      // any component it can't prove safe), so these flag existing patterns
      // rather than new regressions. Kept visible as warnings; burn them down
      // in a dedicated pass rather than inside an SDK upgrade.
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/refs': 'warn',
      'react-hooks/immutability': 'warn',
      'react-hooks/purity': 'warn',
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
      // Design-system drift guards — added 2026-09-26 after a full-app audit
      // found a hardcoded near-black (`#0F0F11` instead of `Colors.ink`) and a
      // modal headline missing `Fonts.serif` entirely, both invisible to
      // tests/typecheck since they're valid RN style values. Baseline was
      // clean (0 hits) at the time these were added — a hit means an actual
      // regression, not pre-existing debt to suppress line-by-line.
      'no-restricted-syntax': [
        'error',
        {
          // Matches any `xColor`/`Color`/`color` key whose value is a literal
          // hex string. rgba()/rgb() aren't matched: white/black overlays on
          // ink/blur backdrops are a legitimate, common exception, and a
          // string-based selector can't tell those apart from a real color
          // token bypass — hex has no such exception, so it's safe to ban
          // outright.
          selector:
            "Property[key.name=/(^color$|Color$)/i] > Literal[value=/^#[0-9A-Fa-f]{3,8}$/]",
          message:
            'Hardcoded hex color — use a Colors.* token from constants/theme.ts instead (add one there first if it genuinely needs to be new).',
        },
        {
          // Valid usage is always a token reference (`Fonts.serif`,
          // `Type.heading.fontFamily`), which is a MemberExpression, not a
          // Literal — so any literal string here is a bypass by construction.
          selector: 'Property[key.name="fontFamily"] > Literal',
          message:
            'Literal fontFamily string — reference Fonts.* from constants/theme.ts instead (e.g. Fonts.serif, Fonts.sansSemiBold).',
        },
      ],
    },
  },
  {
    // constants/theme.ts IS where the Colors/Fonts tokens are defined — the
    // guards above would otherwise flag their own source of truth.
    files: ['constants/theme.ts'],
    rules: {
      'no-restricted-syntax': 'off',
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
