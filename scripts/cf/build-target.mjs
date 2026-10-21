// Per-target OpenNext build (Pitfall 4). One build per target writes
// .open-next/clickit-build-stamp.json; the deploy guard reads the stamp.
// NEXT_PUBLIC_* values are inlined at build time, so the stamp stores sha256
// hashes of them, never the values. This script never prints env values.
//
// Usage:
//   node scripts/cf/build-target.mjs --target preview
//   node scripts/cf/build-target.mjs --target workersdev --media-flag off
//   node scripts/cf/build-target.mjs --target workersdev --media-flag verified \
//        --media-origin https://clickit-media.<SUB>.workers.dev \
//        --verify-report .tmp/r2-media-reports/verify-<timestamp>.json
//   node scripts/cf/build-target.mjs --target production --media-flag verified \
//        --verify-report <report made against https://media.clickitstory.ae> [--manifest <path>]
//   (production reads /Users/koss/.clickit-cloudflare/clickit.production.env; the stamp
//   records the sha256 of the report file, and cf:deploy:production deploys only that build)

import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  NEXT_ENV_MODULE_PATH,
  PRODUCTION_MEDIA_ORIGIN,
  checkEnvFiles,
  checkNextEnvModule,
  checkVerifyReport,
  findFoldedEnvFiles,
  isAllowedMediaOrigin,
} from './deploy-guard.mjs'
import { CLICKIT_HOME, checkEnv } from './wrangler-guard.mjs'

export { PRODUCTION_MEDIA_ORIGIN }
export const PREVIEW_ENV_FILE = '.env.preview.local'
export const WORKERSDEV_ENV_FILE = `${CLICKIT_HOME}/clickit.workersdev.env`
// Production (www) build env file: outside the repo, next to the wrangler login (D-07).
export const PRODUCTION_ENV_FILE = `${CLICKIT_HOME}/clickit.production.env`
export const PRODUCTION_SITE_URL = 'https://www.clickitstory.ae'
// The live project's API URL. Public (it ships in every client bundle), so pinned here:
// a production build against any other project, the placeholder or a typo is refused.
export const PRODUCTION_SUPABASE_URL = 'https://lajguozmtissnnfccmej.supabase.co'
export const STAMP_PATH = '.open-next/clickit-build-stamp.json'
export const DEFAULT_MANIFEST_PATH = '.tmp/r2-media-manifest.json'
export const PREVIEW_MEDIA_ORIGIN = 'http://127.0.0.1:8789'

const KNOWN_PUBLIC = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'NEXT_PUBLIC_SITE_URL',
  'NEXT_PUBLIC_MEDIA_ORIGIN',
  'NEXT_PUBLIC_MEDIA_CUTOVER_READY',
  'NEXT_PUBLIC_MEDIA_ALLOW_LOOPBACK',
  'NEXT_PUBLIC_TURNSTILE_SITE_KEY',
  'NEXT_PUBLIC_CF_BEACON_TOKEN',
]
const LOOPBACK = /127\.0\.0\.1|localhost|0\.0\.0\.0|::1/i
// Cloudflare's published Turnstile test site keys (always pass, always block,
// forced interaction; visible and invisible). Fine for local preview and tests
// only: a deploy stamp carrying one is refused by the deploy guard.
const TURNSTILE_TEST_SITE_KEY = /^[0-9]x0{20}[A-Z]{2}$/

/**
 * Classify the site key without storing it: 'missing', 'test' or 'real'.
 * @param {string | undefined} value
 * @returns {'missing' | 'test' | 'real'}
 */
export function classifyTurnstileSiteKey(value) {
  const key = String(value ?? '').trim()
  if (key === '') return 'missing'
  return TURNSTILE_TEST_SITE_KEY.test(key) ? 'test' : 'real'
}

const JWT_SHAPE = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/

/**
 * Classify a Supabase API key without storing it (D-02). 'secret' is never allowed in
 * a build (NEXT_PUBLIC values are inlined into public JavaScript); production needs
 * 'publishable'.
 * @param {string | undefined} value
 * @returns {'missing' | 'publishable' | 'secret' | 'legacy-jwt' | 'other'}
 */
export function classifySupabaseKey(value) {
  const key = String(value ?? '').trim()
  if (key === '') return 'missing'
  if (key.startsWith('sb_publishable_')) return 'publishable'
  if (key.startsWith('sb_secret_')) return 'secret'
  if (JWT_SHAPE.test(key)) return 'legacy-jwt'
  return 'other'
}

// T-03-06: no NEXT_PUBLIC value may carry a Supabase secret key, for any target.
function refuseSecretKeys(publicEnv) {
  for (const [name, value] of Object.entries(publicEnv)) {
    if (classifySupabaseKey(value) === 'secret') {
      throw new Error(`${name} carries a Supabase secret (sb_secret_) key: it would be public in the bundle`)
    }
  }
}

/**
 * KEY=VALUE parser. Handles comments, blank lines, `export ` and quotes.
 * @param {string} text
 * @returns {Record<string, string>}
 */
export function parseEnvFile(text) {
  const out = {}
  for (const raw of String(text).split('\n')) {
    const line = raw.trim()
    if (!line || line.startsWith('#')) continue
    const match = /^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)=(.*)$/.exec(line)
    if (!match) continue
    let value = match[2].trim()
    if (
      value.length >= 2 &&
      ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'")))
    ) {
      value = value.slice(1, -1)
    }
    out[match[1]] = value
  }
  return out
}

function requireHttpsSite(value) {
  let url
  try {
    url = new URL(value)
  } catch {
    throw new Error('NEXT_PUBLIC_SITE_URL is not a URL')
  }
  const host = url.hostname
  const allowedHost = host.endsWith('.workers.dev') || host === 'clickitstory.ae' || host.endsWith('.clickitstory.ae')
  if (url.protocol !== 'https:' || !allowedHost) {
    throw new Error('NEXT_PUBLIC_SITE_URL must be an https workers.dev or clickitstory.ae origin')
  }
}

/**
 * Compute the build env for a target. Returns only the variables the build
 * script passes on top of a minimal process env.
 * @param {'preview' | 'workersdev' | 'production'} target
 * @param {Record<string, string>} fileEnv
 * @param {{ mediaFlag?: 'off' | 'verified', mediaOrigin?: string, verifyReport?: any, manifest?: any }} [options]
 * @param {Record<string, string | undefined>} [processEnv]
 * @returns {Record<string, string>}
 */
export function buildEnvFor(target, fileEnv, options = {}, processEnv = process.env) {
  if (processEnv.VERCEL || processEnv.VERCEL_ENV) {
    throw new Error('refused: VERCEL or VERCEL_ENV is set; no Vercel build gets a Cloudflare target')
  }
  if (target !== 'preview' && target !== 'workersdev' && target !== 'production') {
    throw new Error(`unknown build target ${String(target)}`)
  }

  const publicFromFile = {}
  for (const [name, value] of Object.entries(fileEnv ?? {})) {
    if (name.startsWith('NEXT_PUBLIC_')) publicFromFile[name] = value
  }
  refuseSecretKeys(publicFromFile)

  if (target === 'production') return productionEnv(publicFromFile, options)

  if (target === 'preview') {
    const env = { ...publicFromFile }
    delete env.NEXT_PUBLIC_MEDIA_CUTOVER_READY
    env.NEXT_PUBLIC_MEDIA_ALLOW_LOOPBACK = '1'
    env.NEXT_PUBLIC_MEDIA_ORIGIN = PREVIEW_MEDIA_ORIGIN
    env.CSP_UPGRADE_INSECURE = 'false'
    if (fileEnv.NEXTJS_ENV) env.NEXTJS_ENV = fileEnv.NEXTJS_ENV
    if (fileEnv.LOCAL_DEV) env.LOCAL_DEV = fileEnv.LOCAL_DEV
    return env
  }

  // workersdev: every known public name is set explicitly (empty when unused)
  // so no stray .env.local value can leak into the inlined build.
  for (const name of ['NEXT_PUBLIC_SITE_URL', 'NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY']) {
    if (!publicFromFile[name]) throw new Error(`${name} is missing from the workers.dev env file`)
  }
  requireHttpsSite(publicFromFile.NEXT_PUBLIC_SITE_URL)

  const flag = options.mediaFlag ?? 'off'
  if (flag !== 'off' && flag !== 'verified') {
    throw new Error(`unknown media flag ${String(flag)}: use off or verified`)
  }

  const env = {}
  for (const name of KNOWN_PUBLIC) env[name] = ''
  Object.assign(env, publicFromFile)
  env.NEXT_PUBLIC_MEDIA_ALLOW_LOOPBACK = ''
  env.NEXT_PUBLIC_MEDIA_CUTOVER_READY = ''
  env.NEXT_PUBLIC_MEDIA_ORIGIN = ''
  env.LOCAL_DEV = ''
  env.NEXTJS_ENV = 'production'

  if (flag === 'verified') {
    if (!isAllowedMediaOrigin(options.mediaOrigin)) {
      throw new Error('media origin must be an https clickit-media[-r2].<sub>.workers.dev origin')
    }
    const res = checkVerifyReport(options.verifyReport, options.manifest ?? null, {
      mediaOrigin: options.mediaOrigin,
    })
    if (!res.ok) throw new Error(`media flag refused: ${res.reasons.join('; ')}`)
    env.NEXT_PUBLIC_MEDIA_CUTOVER_READY = 'verified'
    env.NEXT_PUBLIC_MEDIA_ORIGIN = new URL(options.mediaOrigin).origin
  }
  return env
}

// Production (www): every rule of D-02, D-07, D-08 and PLAT-05 holds by construction.
function productionEnv(publicFromFile, options) {
  if (publicFromFile.NEXT_PUBLIC_SITE_URL !== PRODUCTION_SITE_URL) {
    throw new Error(`NEXT_PUBLIC_SITE_URL must be exactly ${PRODUCTION_SITE_URL} for the production target`)
  }
  // Exact match, no trailing slash: the value itself is never printed (PR #31 review 3).
  if (publicFromFile.NEXT_PUBLIC_SUPABASE_URL !== PRODUCTION_SUPABASE_URL) {
    const state = String(publicFromFile.NEXT_PUBLIC_SUPABASE_URL ?? '') === '' ? 'is missing' : 'is a different value'
    throw new Error(
      `NEXT_PUBLIC_SUPABASE_URL ${state} in the production env file: it must be exactly ${PRODUCTION_SUPABASE_URL} (no trailing slash)`
    )
  }
  const keyKind = classifySupabaseKey(publicFromFile.NEXT_PUBLIC_SUPABASE_ANON_KEY)
  if (keyKind !== 'publishable') {
    throw new Error(`NEXT_PUBLIC_SUPABASE_ANON_KEY is ${keyKind}: production needs the publishable (sb_publishable_) key`)
  }
  if (String(publicFromFile.NEXT_PUBLIC_CF_BEACON_TOKEN ?? '').trim() === '') {
    throw new Error('NEXT_PUBLIC_CF_BEACON_TOKEN (Web Analytics) is empty in the production env file')
  }
  const turnstile = classifyTurnstileSiteKey(publicFromFile.NEXT_PUBLIC_TURNSTILE_SITE_KEY)
  if (turnstile !== 'real') {
    throw new Error(`NEXT_PUBLIC_TURNSTILE_SITE_KEY is ${turnstile}: production needs the real site key`)
  }
  if (options.mediaFlag !== 'verified') {
    throw new Error('the production target needs --media-flag verified')
  }
  let origin = null
  try {
    origin = new URL(String(options.mediaOrigin)).origin
  } catch {
    origin = null
  }
  if (origin !== PRODUCTION_MEDIA_ORIGIN || !isAllowedMediaOrigin(options.mediaOrigin)) {
    throw new Error(`media origin must be ${PRODUCTION_MEDIA_ORIGIN} for the production target`)
  }
  const res = checkVerifyReport(options.verifyReport, options.manifest ?? null, { mediaOrigin: PRODUCTION_MEDIA_ORIGIN })
  if (!res.ok) throw new Error(`media flag refused: ${res.reasons.join('; ')}`)

  // Every known public name is set explicitly so no stray .env.local value leaks in.
  const env = {}
  for (const name of KNOWN_PUBLIC) env[name] = ''
  Object.assign(env, publicFromFile)
  env.NEXT_PUBLIC_SITE_URL = PRODUCTION_SITE_URL
  env.NEXT_PUBLIC_MEDIA_ALLOW_LOOPBACK = ''
  env.NEXT_PUBLIC_MEDIA_CUTOVER_READY = 'verified'
  env.NEXT_PUBLIC_MEDIA_ORIGIN = PRODUCTION_MEDIA_ORIGIN
  env.LOCAL_DEV = ''
  env.NEXTJS_ENV = 'production'
  return env
}

const sha256 = (value) => createHash('sha256').update(String(value)).digest('hex')

/**
 * Build the stamp. Hashes and classes only; never the values. `verifyReportSha256`
 * (production) is the sha256 of the verify report file bytes the build used.
 * @param {{ target: string, gitSha: string, createdAt: string, env: Record<string, string>, verifyReportSha256?: string }} input
 */
export function makeStamp({ target, gitSha, createdAt, env, verifyReportSha256 }) {
  const publicHashes = {}
  for (const name of Object.keys(env).filter((n) => n.startsWith('NEXT_PUBLIC_')).sort()) {
    publicHashes[name] = sha256(env[name])
  }
  const values = Object.values(env).map(String)
  const verified = env.NEXT_PUBLIC_MEDIA_CUTOVER_READY === 'verified'
  return {
    target,
    gitSha,
    createdAt,
    mediaFlag: verified ? 'verified' : 'off',
    mediaOrigin: verified ? env.NEXT_PUBLIC_MEDIA_ORIGIN : '',
    publicHashes,
    hasLoopback: values.some((v) => LOOPBACK.test(v)),
    hasLocalSupabase: values.some((v) => v.includes(':55321')),
    localDev: Boolean(env.LOCAL_DEV),
    // Classification only, never the key itself (PLAT-05, T-02-61).
    turnstileSiteKey: classifyTurnstileSiteKey(env.NEXT_PUBLIC_TURNSTILE_SITE_KEY),
    supabaseKeyKind: classifySupabaseKey(env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
    beaconToken: String(env.NEXT_PUBLIC_CF_BEACON_TOKEN ?? '').trim() === '' ? 'missing' : 'set',
    ...(verifyReportSha256 ? { verifyReportSha256 } : {}),
  }
}

/** Manifest identity used by the verify-report comparison. */
export function loadManifestInfo(path) {
  const text = readFileSync(path, 'utf8')
  const parsed = JSON.parse(text)
  const list = Array.isArray(parsed) ? parsed : (parsed.objects ?? parsed.entries ?? parsed.items)
  if (!Array.isArray(list)) throw new Error('media manifest has no objects list')
  return { manifestSha256: sha256Buffer(text), manifestObjectCount: list.length }
}

function sha256Buffer(text) {
  return createHash('sha256').update(text).digest('hex')
}

/** sha256 of a file's bytes (the verify report identity recorded in the production stamp). */
export function fileSha256(path) {
  return createHash('sha256').update(readFileSync(path)).digest('hex')
}

/**
 * The production build needs both `--media-flag verified` and `--verify-report <path>`
 * spelled out; `--media-origin`, when given, must be the production media host.
 * @param {string[]} argv
 * @returns {{ ok: boolean, reasons: string[] }}
 */
export function checkProductionBuildArgs(argv) {
  const list = Array.isArray(argv) ? argv : []
  const reasons = []
  if (readOption(list, '--media-flag') !== 'verified') {
    reasons.push('the production target needs --media-flag verified')
  }
  const report = readOption(list, '--verify-report')
  if (!report || report.startsWith('--')) {
    reasons.push('the production target needs --verify-report <path> (a report made against https://media.clickitstory.ae)')
  }
  const origin = readOption(list, '--media-origin')
  if (origin !== undefined && origin !== PRODUCTION_MEDIA_ORIGIN) {
    reasons.push(`--media-origin must be ${PRODUCTION_MEDIA_ORIGIN} for the production target`)
  }
  return { ok: reasons.length === 0, reasons }
}

function readOption(argv, name) {
  const i = argv.indexOf(name)
  return i >= 0 ? argv[i + 1] : undefined
}

function git(args) {
  const res = spawnSync('git', args, { encoding: 'utf8' })
  if (res.status !== 0) throw new Error(`git ${args[0]} failed`)
  return res.stdout.trim()
}

function main(argv) {
  const target = readOption(argv, '--target')
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
  process.chdir(root)

  const envFile =
    target === 'preview'
      ? PREVIEW_ENV_FILE
      : target === 'workersdev'
        ? WORKERSDEV_ENV_FILE
        : target === 'production'
          ? PRODUCTION_ENV_FILE
          : null
  if (!envFile) {
    console.error('usage: build-target.mjs --target preview|workersdev|production [--media-flag off|verified ...]')
    return 1
  }
  if (target === 'production') {
    const args = checkProductionBuildArgs(argv)
    if (!args.ok) {
      for (const reason of args.reasons) console.error(`refused: ${reason}`)
      return 1
    }
  }
  // The preview target may run without its gitignored file (gate:local in a
  // clean clone): public values then come from the shell env, if any.
  if (!existsSync(envFile) && target !== 'preview') {
    console.error(`refused: env file for target ${target} not found (${envFile})`)
    return 1
  }
  // The preview build is local only (XDG_CONFIG_HOME allowed); workersdev is deployable.
  const envCheck = checkEnv(process.env, target === 'preview' ? 'local' : 'remote')
  if (!envCheck.ok) {
    console.error(envCheck.reason)
    return 1
  }
  // A deployable build must not fold .env values into the bundle. The local
  // preview build is never deployed, so it keeps working with a dev .env.local.
  const deployable = target === 'workersdev' || target === 'production'
  if (deployable) {
    const files = checkEnvFiles(findFoldedEnvFiles(root))
    if (!files.ok) {
      for (const reason of files.reasons) console.error(`refused: ${reason}`)
      return 1
    }
  }

  let buildEnv
  let verifyReportSha256
  try {
    const fileEnv = existsSync(envFile) ? parseEnvFile(readFileSync(envFile, 'utf8')) : {}
    if (target === 'preview') {
      for (const [name, value] of Object.entries(process.env)) {
        if (name.startsWith('NEXT_PUBLIC_') && value !== undefined && !(name in fileEnv)) fileEnv[name] = value
      }
    }
    const mediaFlag = readOption(argv, '--media-flag') ?? 'off'
    const options = { mediaFlag, mediaOrigin: readOption(argv, '--media-origin') }
    if (target === 'production') options.mediaOrigin = options.mediaOrigin ?? PRODUCTION_MEDIA_ORIGIN
    if (deployable && mediaFlag === 'verified') {
      const reportPath = readOption(argv, '--verify-report')
      if (!reportPath) throw new Error('--verify-report is required with --media-flag verified')
      if (!existsSync(reportPath)) throw new Error('verify report file not found')
      options.verifyReport = JSON.parse(readFileSync(reportPath, 'utf8'))
      options.manifest = loadManifestInfo(readOption(argv, '--manifest') ?? DEFAULT_MANIFEST_PATH)
      if (target === 'production') verifyReportSha256 = fileSha256(reportPath)
    }
    buildEnv = buildEnvFor(target, fileEnv, options, process.env)
  } catch (error) {
    console.error(`refused: ${error.message}`)
    return 1
  }

  const minimal = { HOME: CLICKIT_HOME, WRANGLER_SEND_METRICS: 'false' }
  for (const name of ['PATH', 'TMPDIR', 'LANG', 'TERM']) {
    if (process.env[name]) minimal[name] = process.env[name]
  }
  const res = spawnSync('npx', ['opennextjs-cloudflare', 'build'], {
    env: { ...minimal, ...buildEnv },
    stdio: 'inherit',
  })
  if (res.status !== 0) {
    console.error(`build failed (exit ${res.status})`)
    return res.status ?? 1
  }

  if (deployable) {
    const text = existsSync(NEXT_ENV_MODULE_PATH) ? readFileSync(NEXT_ENV_MODULE_PATH, 'utf8') : null
    const folded = checkNextEnvModule(text)
    if (!folded.ok) {
      // No stamp: the deploy guard then refuses this build as well.
      for (const reason of folded.reasons) console.error(`refused: ${reason}`)
      return 1
    }
  }

  const stamp = makeStamp({
    target,
    gitSha: git(['rev-parse', 'HEAD']),
    createdAt: new Date().toISOString(),
    env: buildEnv,
    verifyReportSha256: target === 'production' ? verifyReportSha256 : undefined,
  })
  mkdirSync(dirname(STAMP_PATH), { recursive: true })
  writeFileSync(STAMP_PATH, `${JSON.stringify(stamp, null, 2)}\n`)
  console.log(`build stamp written: target ${stamp.target}, media flag ${stamp.mediaFlag}`)
  return 0
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  process.exit(main(process.argv.slice(2)))
}
