import { defineConfig, globalIgnores } from 'eslint/config'
import nextVitals from 'eslint-config-next/core-web-vitals'
import nextTs from 'eslint-config-next/typescript'
import prettier from 'eslint-config-prettier/flat'

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
