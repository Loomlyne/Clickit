import { defineConfig, globalIgnores } from 'eslint/config'
import nextVitals from 'eslint-config-next/core-web-vitals'
import nextTs from 'eslint-config-next/typescript'
import prettier from 'eslint-config-prettier/flat'
import clickit from './eslint-rules/clickit-tokens.mjs'

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  prettier,
  // Phase 4 DS-02 guard. warn until the codemod lands; 04-13 flips it to error.
  {
    files: ['src/**/*.{ts,tsx}'],
    plugins: { clickit },
    rules: { 'clickit/no-raw-design-values': 'warn' },
  },
  // Allowlist for files that legitimately hold raw values:
  // - src/lib/brand-colors.ts: the one brand colour map
  // - src/lib/design-truth.ts: the signed token values and codemod maps
  // - src/lib/email-tokens.ts: email-safe literal hex for both schemes (Q7 = C)
  // - src/emails/** and src/lib/mail/templates/**: future Phase 5 email
  //   templates carry inline hex because mail clients cannot read CSS variables
  // CSS files are not linted; src/styles/*.css and ui.config.json are the token sources.
  {
    files: [
      'src/lib/brand-colors.ts',
      'src/lib/design-truth.ts',
      'src/lib/email-tokens.ts',
      'src/emails/**',
      'src/lib/mail/templates/**',
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
  ]),
])

export default eslintConfig
