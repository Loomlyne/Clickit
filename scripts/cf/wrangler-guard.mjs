// Wrangler account guard (D-04, T-02-01). Every wrangler command in this repo
// runs with HOME=/Users/koss/.clickit-cloudflare after this guard passes. It
// refuses the default (Vamos) login, any other account, API-token or API-key
// auth and a redirected wrangler config (XDG_CONFIG_HOME, API base URL).
//
// Usage:
//   node scripts/cf/wrangler-guard.mjs --local    # not-authenticated or ClickitStory only
//   node scripts/cf/wrangler-guard.mjs --remote   # ClickitStory must appear
//
// Prints only "wrangler-guard ok <mode>" or the reason. Exit 1 on refusal.

import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

export const CLICKIT_ACCOUNT_ID = 'e329b099b6e4272fc0915a99832e47fe'
export const CLICKIT_HOME = '/Users/koss/.clickit-cloudflare'

const HEX32 = /\b[0-9a-f]{32}\b/gi
const NOT_AUTHENTICATED = /not authenticated|not logged in|You are not authenticated/i

/**
 * @param {string} text  combined stdout+stderr of `wrangler whoami`
 * @param {'local' | 'remote'} mode
 * @returns {{ ok: boolean, reason: string }}
 */
export function checkWhoamiOutput(text, mode) {
  const ids = [...new Set((String(text ?? '').match(HEX32) ?? []).map((id) => id.toLowerCase()))]
  const others = ids.filter((id) => id !== CLICKIT_ACCOUNT_ID)
  if (others.length > 0) {
    return { ok: false, reason: 'refused: wrangler reports an account other than ClickitStory' }
  }
  const hasClickit = ids.includes(CLICKIT_ACCOUNT_ID)
  if (mode === 'remote') {
    return hasClickit
      ? { ok: true, reason: 'ClickitStory account only' }
      : { ok: false, reason: 'refused: ClickitStory account id not found in wrangler whoami (remote mode)' }
  }
  if (mode === 'local') {
    if (hasClickit) return { ok: true, reason: 'ClickitStory account only' }
    if (NOT_AUTHENTICATED.test(String(text ?? ''))) {
      return { ok: true, reason: 'not authenticated (local mode)' }
    }
    return { ok: false, reason: 'refused: wrangler whoami output is neither ClickitStory nor not-authenticated' }
  }
  return { ok: false, reason: `refused: unknown mode ${String(mode)}` }
}

// Any of these lets wrangler authenticate (or read its config) somewhere other
// than the pinned ClickitStory login under CLICKIT_HOME. CF_* are wrangler's
// deprecated aliases, still honoured by wrangler 4.
export const REFUSED_ENV_NAMES = [
  'CLOUDFLARE_API_TOKEN',
  'CF_API_TOKEN',
  'CLOUDFLARE_API_KEY',
  'CF_API_KEY',
  'CLOUDFLARE_EMAIL',
  'CF_EMAIL',
  'CLOUDFLARE_API_BASE_URL',
  'CF_API_BASE_URL',
  'XDG_CONFIG_HOME',
]
const ACCOUNT_ENV_NAMES = ['CLOUDFLARE_ACCOUNT_ID', 'CF_ACCOUNT_ID']

/**
 * Names only in the reason, never a value.
 * @param {Record<string, string | undefined>} env
 * @returns {{ ok: boolean, reason: string }}
 */
export function checkEnv(env) {
  const set = REFUSED_ENV_NAMES.filter((name) => env[name])
  if (set.length > 0) {
    return { ok: false, reason: `refused: ${set.join(', ')} set; use the pinned wrangler login only` }
  }
  for (const name of ACCOUNT_ENV_NAMES) {
    const acct = env[name]
    if (acct && acct.toLowerCase() !== CLICKIT_ACCOUNT_ID) {
      return { ok: false, reason: `refused: ${name} is not the ClickitStory account` }
    }
  }
  return { ok: true, reason: 'env ok' }
}

/**
 * The only env a wrangler child gets: PATH, the pinned HOME and metrics off.
 * Nothing else from the parent shell (tokens, XDG paths, account ids) passes.
 * @param {Record<string, string | undefined>} processEnv
 */
export function wranglerChildEnv(processEnv) {
  return { PATH: processEnv.PATH ?? '', HOME: CLICKIT_HOME, WRANGLER_SEND_METRICS: 'false' }
}

function main(argv) {
  const mode = argv.includes('--remote') ? 'remote' : 'local'
  if (process.env.HOME !== CLICKIT_HOME) {
    console.error(`refused: HOME must be ${CLICKIT_HOME}`)
    return 1
  }
  const envCheck = checkEnv(process.env)
  if (!envCheck.ok) {
    console.error(envCheck.reason)
    return 1
  }
  const res = spawnSync('npx', ['wrangler', 'whoami'], {
    env: wranglerChildEnv(process.env),
    encoding: 'utf8',
  })
  if (res.error) {
    console.error(`refused: could not run wrangler whoami (${res.error.message})`)
    return 1
  }
  const text = `${res.stdout ?? ''}\n${res.stderr ?? ''}`
  const check = checkWhoamiOutput(text, mode)
  if (!check.ok) {
    console.error(check.reason)
    return 1
  }
  console.log(`wrangler-guard ok ${mode}`)
  return 0
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  process.exit(main(process.argv.slice(2)))
}
