// Wrangler account guard (D-04, T-02-01). Every wrangler command in this repo
// runs with HOME=/Users/koss/.clickit-cloudflare after this guard passes. It
// refuses the default (Vamos) login, any other account, and API-token auth.
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

/**
 * @param {Record<string, string | undefined>} env
 * @returns {{ ok: boolean, reason: string }}
 */
export function checkEnv(env) {
  if (env.CLOUDFLARE_API_TOKEN) {
    return { ok: false, reason: 'refused: CLOUDFLARE_API_TOKEN is set; use the pinned wrangler login only' }
  }
  const acct = env.CLOUDFLARE_ACCOUNT_ID
  if (acct && acct.toLowerCase() !== CLICKIT_ACCOUNT_ID) {
    return { ok: false, reason: 'refused: CLOUDFLARE_ACCOUNT_ID is not the ClickitStory account' }
  }
  return { ok: true, reason: 'env ok' }
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
    env: { ...process.env, HOME: CLICKIT_HOME },
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
