import { defineConfig, globalIgnores } from 'eslint/config'
import nextVitals from 'eslint-config-next/core-web-vitals'
import nextTs from 'eslint-config-next/typescript'
import prettier from 'eslint-config-prettier/flat'
import clickit from './eslint-rules/clickit-tokens.mjs'

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  prettier,
  {
    // eslint-config-next 16.4.2 (react-hooks plugin bump) flags four existing
    // effects (admin tables, carousel) that 16.2.9 accepted. Kept as a warning
    // so the Next 16.4.2 upgrade (plan 02-01) does not rewrite UI code.
    rules: { 'react-hooks/set-state-in-effect': 'warn' },
  },
  // Phase 4 DS-02 guard (error since 04-13)
  {
    files: ['src/**/*.{ts,tsx}'],
    plugins: { clickit },
    rules: { 'clickit/no-raw-design-values': 'error' },
  },
  // Allowlist for files that legitimately hold raw values:
  // - src/lib/brand-colors.ts: the one brand colour map
  // - src/lib/design-truth.ts: the signed token values and codemod maps
  // - src/lib/email-tokens.ts: email-safe literal hex for both schemes (Q7 = C)
  // Email templates take their colours from email-tokens.ts, so they need no
  // entry here; Phase 5 adds a file only if it truly needs raw hex.
  // CSS files are not linted; src/styles/*.css and ui.config.json are the token sources.
  {
    files: [
      'src/lib/brand-colors.ts',
      'src/lib/design-truth.ts',
      'src/lib/email-tokens.ts',
    ],
    rules: { 'clickit/no-raw-design-values': 'off' },
  },
  globalIgnores([
    '.next/**',
    '.vercel/**',
    '**/.vercel/**',
    '.claude/**',
    '**/.claude/**',
    'out/**',
    'build/**',
    '.planning/**',
    'next-env.d.ts',
    '.open-next/**',
    '.wrangler/**',
    'workers/**/.wrangler/**',
  ]),
])

export default eslintConfig
