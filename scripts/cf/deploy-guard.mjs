// Deploy guard (D-03, D-04, PLAT-08). Pure functions: every input is plain data
// read by scripts/cf/deploy.mjs, so each rule is unit-tested without wrangler
// or git. Every function returns { ok, reasons } and collects ALL reasons.
// Values of NEXT_PUBLIC_* are never read here; the stamp holds hashes only.

import { checkWhoamiOutput, checkEnv, CLICKIT_ACCOUNT_ID } from './wrangler-guard.mjs'

export const MEDIA_BINDING = 'MEDIA_BUCKET'
export const MEDIA_BUCKET_NAME = 'clickit-media'
export const MEDIA_ENVS = ['', 'supabase-only']

const ALL_ZERO_ID = /^[0-]+$/
const MEDIA_HOST = /^clickit-media\.[a-z0-9-]+\.workers\.dev$/
const MEDIA_CUSTOM_HOST = 'media.clickitstory.ae'
const BINDING_KEYS = [
  'kv_namespaces',
  'd1_databases',
  'durable_objects',
  'services',
  'queues',
  'ai',
  'vectorize',
  'hyperdrive',
  'analytics_engine_datasets',
  'browser',
  'send_email',
  'mtls_certificates',
  'dispatch_namespaces',
  'unsafe',
]

/**
 * Parse wrangler.jsonc: strips // and /* *\/ comments (outside strings) and
 * trailing commas, then JSON.parse.
 * @param {string} text
 */
export function parseJsonc(text) {
  let out = ''
  let i = 0
  let inString = false
  while (i < text.length) {
    const ch = text[i]
    const next = text[i + 1]
    if (inString) {
      out += ch
      if (ch === '\\') {
        out += next ?? ''
        i += 2
        continue
      }
      if (ch === '"') inString = false
      i += 1
      continue
    }
    if (ch === '"') {
      inString = true
      out += ch
      i += 1
    } else if (ch === '/' && next === '/') {
      while (i < text.length && text[i] !== '\n') i += 1
    } else if (ch === '/' && next === '*') {
      i += 2
      while (i < text.length && !(text[i] === '*' && text[i + 1] === '/')) i += 1
      i += 2
    } else {
      out += ch
      i += 1
    }
  }
  // Trailing commas: a comma followed only by whitespace and a closing bracket,
  // outside strings. Strings were left intact above, so scan again with state.
  let result = ''
  inString = false
  for (let j = 0; j < out.length; j += 1) {
    const ch = out[j]
    if (inString) {
      result += ch
      if (ch === '\\') {
        result += out[j + 1] ?? ''
        j += 1
      } else if (ch === '"') inString = false
      continue
    }
    if (ch === '"') {
      inString = true
      result += ch
    } else if (ch === ',') {
      let k = j + 1
      while (k < out.length && /\s/.test(out[k])) k += 1
      if (out[k] === '}' || out[k] === ']') continue
      result += ch
    } else {
      result += ch
    }
  }
  return JSON.parse(result)
}

/** @param {unknown} origin */
export function isAllowedMediaOrigin(origin) {
  let url
  try {
    url = new URL(String(origin))
  } catch {
    return false
  }
  if (url.protocol !== 'https:' || url.username || url.password) return false
  if (url.pathname !== '/' || url.search || url.hash || url.port) return false
  return MEDIA_HOST.test(url.hostname) || url.hostname === MEDIA_CUSTOM_HOST
}

/**
 * D-03: the media cutover flag may only be set when a verify report proves
 * every object. Rules: https clickit-media origin, same manifest hash, equal
 * counts, zero failures.
 * @param {any} report   verify report from scripts/media/verify-media-host.mjs
 * @param {{ manifestSha256: string, manifestObjectCount: number } | null} manifest
 * @param {{ mediaOrigin?: string }} [options]
 * @returns {{ ok: boolean, reasons: string[] }}
 */
export function checkVerifyReport(report, manifest, options = {}) {
  const reasons = []
  if (!report || typeof report !== 'object') {
    return { ok: false, reasons: ['verify report missing or not an object'] }
  }
  if (!manifest || typeof manifest !== 'object') {
    return { ok: false, reasons: ['media manifest missing, cannot compare the verify report'] }
  }
  if (!Array.isArray(report.failures)) {
    reasons.push('verify report has no failures list')
  } else if (report.failures.length > 0) {
    reasons.push(`verify report has ${report.failures.length} failure(s)`)
  }
  if (!report.manifestSha256 || report.manifestSha256 !== manifest.manifestSha256) {
    reasons.push('verify report manifest hash differs from the current manifest')
  }
  if (
    !Number.isInteger(report.manifestObjectCount) ||
    report.manifestObjectCount !== manifest.manifestObjectCount
  ) {
    reasons.push('verify report manifest object count differs from the current manifest')
  }
  if (!Number.isInteger(report.originalsChecked) || report.originalsChecked !== manifest.manifestObjectCount) {
    reasons.push('verify report originals checked count does not equal the manifest object count')
  }
  if (!isAllowedMediaOrigin(report.origin)) {
    reasons.push('verify report origin is not an https clickit-media.<sub>.workers.dev (or media.clickitstory.ae) origin')
  } else if (options.mediaOrigin && new URL(options.mediaOrigin).origin !== new URL(report.origin).origin) {
    reasons.push('verify report was made against a different media origin than the one being set')
  }
  return { ok: reasons.length === 0, reasons }
}

function accountReasons(whoami, processEnv, reasons) {
  const who = checkWhoamiOutput(whoami, 'remote')
  if (!who.ok) reasons.push(who.reason)
  const env = checkEnv(processEnv ?? {})
  if (!env.ok) reasons.push(env.reason)
  if (processEnv?.VERCEL || processEnv?.VERCEL_ENV) {
    reasons.push('refused: VERCEL or VERCEL_ENV is set in the deploy shell')
  }
}

function emptyCrons(triggers) {
  return Array.isArray(triggers?.crons) && triggers.crons.length === 0
}

/**
 * @param {{
 *   whoami: string,
 *   processEnv: Record<string, string | undefined>,
 *   stamp: any,
 *   headSha: string,
 *   gitStatus: string,
 *   originBranches: string,
 *   wranglerConfig: any,
 *   verifyReport?: any,
 *   manifest?: any,
 * }} input
 * @returns {{ ok: boolean, reasons: string[] }}
 */
export function checkDeploy(input) {
  const reasons = []
  accountReasons(input.whoami, input.processEnv, reasons)

  const stamp = input.stamp
  if (!stamp || typeof stamp !== 'object') {
    reasons.push('build stamp missing: run the workersdev build first (.open-next/clickit-build-stamp.json)')
  } else {
    if (stamp.target !== 'workersdev') reasons.push(`stamp target is ${String(stamp.target)}, expected workersdev`)
    if (stamp.hasLoopback) reasons.push('stamp shows a loopback URL (127.0.0.1, localhost, 0.0.0.0 or ::1) in a NEXT_PUBLIC value')
    if (stamp.hasLocalSupabase) reasons.push('stamp shows the local Supabase URL (port 55321) in a NEXT_PUBLIC value')
    if (stamp.localDev) reasons.push('stamp shows LOCAL_DEV was set in the build')
    if (stamp.turnstileSiteKey === 'test') {
      reasons.push('stamp carries a Cloudflare Turnstile TEST site key: set the real NEXT_PUBLIC_TURNSTILE_SITE_KEY and rebuild')
    } else if (stamp.turnstileSiteKey !== 'real') {
      reasons.push('stamp has no NEXT_PUBLIC_TURNSTILE_SITE_KEY: the forms would have no Turnstile widget; set it and rebuild')
    }
    if (!stamp.gitSha || stamp.gitSha !== input.headSha) {
      reasons.push('stamp commit differs from HEAD: rebuild at the current commit')
    }
    if (stamp.mediaFlag === 'verified') {
      const res = checkVerifyReport(input.verifyReport, input.manifest ?? null, { mediaOrigin: stamp.mediaOrigin })
      if (!res.ok) reasons.push(...res.reasons.map((r) => `media flag verified but ${r}`))
    } else if (stamp.mediaFlag !== 'off') {
      reasons.push(`stamp media flag is ${String(stamp.mediaFlag)}, expected off or verified`)
    }
  }

  if (String(input.gitStatus ?? '').trim() !== '') reasons.push('working tree is dirty: commit or remove changes first')

  const onOrigin = String(input.originBranches ?? '')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !line.includes('->'))
  if (onOrigin.length === 0) reasons.push('HEAD is not contained in any origin branch: push the commit first')

  const config = input.wranglerConfig
  if (!config || typeof config !== 'object') {
    reasons.push('wrangler.jsonc could not be read')
  } else {
    if (config.account_id !== CLICKIT_ACCOUNT_ID) reasons.push('wrangler.jsonc account_id is not the ClickitStory account')
    const d1 = Array.isArray(config.d1_databases) ? config.d1_databases : []
    if (d1.length === 0) reasons.push('wrangler.jsonc has no d1 database')
    for (const db of d1) {
      const id = String(db?.database_id ?? '')
      if (!id || ALL_ZERO_ID.test(id)) reasons.push('d1 database_id is the all-zero placeholder (write the real id first)')
    }
    if (!emptyCrons(config.triggers)) reasons.push('wrangler.jsonc triggers.crons must be an explicit empty array')
    if (config.vars && Object.prototype.hasOwnProperty.call(config.vars, 'LOCAL_DEV')) {
      reasons.push('wrangler.jsonc vars contain LOCAL_DEV')
    }
  }
  return { ok: reasons.length === 0, reasons }
}

function bindingReasons(level, label, reasons, { expectR2 }) {
  const r2 = Array.isArray(level?.r2_buckets) ? level.r2_buckets : []
  if (expectR2) {
    const okOne =
      r2.length === 1 && r2[0]?.binding === MEDIA_BINDING && r2[0]?.bucket_name === MEDIA_BUCKET_NAME
    if (!okOne) {
      reasons.push(`${label}: expected exactly one R2 binding ${MEDIA_BINDING} -> ${MEDIA_BUCKET_NAME}`)
    }
  } else if (r2.length > 0) {
    reasons.push(`${label}: the supabase-only env must have no R2 binding`)
  }
  for (const key of BINDING_KEYS) {
    const value = level?.[key]
    const present = Array.isArray(value) ? value.length > 0 : value && typeof value === 'object' ? Object.keys(value).length > 0 : Boolean(value)
    if (present) reasons.push(`${label}: unexpected binding kind ${key}`)
  }
}

function varsReasons(vars, label, reasons) {
  const names = Object.keys(vars ?? {})
  const url = vars?.SUPABASE_URL
  if (!url) {
    reasons.push(`${label}: SUPABASE_URL var is missing`)
  } else {
    try {
      const parsed = new URL(url)
      if (parsed.protocol !== 'https:' || !parsed.hostname.endsWith('.supabase.co')) {
        reasons.push(`${label}: SUPABASE_URL must be an https supabase.co URL`)
      }
    } catch {
      reasons.push(`${label}: SUPABASE_URL is not a URL`)
    }
  }
  for (const name of names) {
    if (name !== 'SUPABASE_URL') reasons.push(`${label}: unexpected var ${name}`)
  }
}

/**
 * Media Worker (workers/media/wrangler.jsonc). Deploys either the top-level
 * config (env '') with the MEDIA_BUCKET R2 binding, or the supabase-only env
 * with no R2 binding. Both need the SUPABASE_URL var. The env is always passed
 * explicitly so wrangler never guesses.
 * @param {{
 *   whoami: string,
 *   processEnv: Record<string, string | undefined>,
 *   gitStatus: string,
 *   wranglerConfig: any,
 *   env: '' | 'supabase-only' | undefined,
 * }} input
 * @returns {{ ok: boolean, reasons: string[] }}
 */
export function checkMediaDeploy(input) {
  const reasons = []
  accountReasons(input.whoami, input.processEnv, reasons)
  if (String(input.gitStatus ?? '').trim() !== '') reasons.push('working tree is dirty: commit or remove changes first')

  const config = input.wranglerConfig
  if (!MEDIA_ENVS.includes(input.env)) {
    reasons.push('media deploy env must be passed explicitly: "" (top level) or "supabase-only"')
  }
  if (!config || typeof config !== 'object') {
    reasons.push('workers/media/wrangler.jsonc could not be read')
    return { ok: false, reasons }
  }
  if (config.account_id !== CLICKIT_ACCOUNT_ID) reasons.push('media wrangler account_id is not the ClickitStory account')
  if (config.name !== 'clickit-media') reasons.push('media wrangler name is not clickit-media')

  if (input.env === 'supabase-only') {
    const envConfig = config.env?.['supabase-only']
    if (!envConfig) {
      reasons.push('supabase-only env is not defined in workers/media/wrangler.jsonc')
    } else {
      bindingReasons(envConfig, 'supabase-only', reasons, { expectR2: false })
      varsReasons(envConfig.vars, 'supabase-only', reasons)
      if (envConfig.triggers !== undefined && !emptyCrons(envConfig.triggers)) {
        reasons.push('supabase-only: triggers.crons must be an empty array')
      }
    }
    // triggers are inheritable, so the top level counts for this env as well.
    if (!emptyCrons(config.triggers)) reasons.push('media wrangler triggers.crons must be an explicit empty array')
  } else {
    bindingReasons(config, 'top level', reasons, { expectR2: true })
    varsReasons(config.vars, 'top level', reasons)
    if (!emptyCrons(config.triggers)) reasons.push('media wrangler triggers.crons must be an explicit empty array')
  }
  return { ok: reasons.length === 0, reasons }
}
