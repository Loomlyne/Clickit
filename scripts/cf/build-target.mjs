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

import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  NEXT_ENV_MODULE_PATH,
  checkEnvFiles,
  checkNextEnvModule,
  checkVerifyReport,
  findFoldedEnvFiles,
  isAllowedMediaOrigin,
} from './deploy-guard.mjs'
import { CLICKIT_HOME, checkEnv } from './wrangler-guard.mjs'

export const PREVIEW_ENV_FILE = '.env.preview.local'
export const WORKERSDEV_ENV_FILE = `${CLICKIT_HOME}/clickit.workersdev.env`
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
 * @param {'preview' | 'workersdev'} target
 * @param {Record<string, string>} fileEnv
 * @param {{ mediaFlag?: 'off' | 'verified', mediaOrigin?: string, verifyReport?: any, manifest?: any }} [options]
 * @param {Record<string, string | undefined>} [processEnv]
 * @returns {Record<string, string>}
 */
export function buildEnvFor(target, fileEnv, options = {}, processEnv = process.env) {
  if (processEnv.VERCEL || processEnv.VERCEL_ENV) {
    throw new Error('refused: VERCEL or VERCEL_ENV is set; no Vercel build gets a Cloudflare target')
  }
  if (target !== 'preview' && target !== 'workersdev') {
    throw new Error(`unknown build target ${String(target)}`)
  }

  const publicFromFile = {}
  for (const [name, value] of Object.entries(fileEnv ?? {})) {
    if (name.startsWith('NEXT_PUBLIC_')) publicFromFile[name] = value
  }

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

const sha256 = (value) => createHash('sha256').update(String(value)).digest('hex')

/**
 * Build the stamp. Hashes only; never the values.
 * @param {{ target: string, gitSha: string, createdAt: string, env: Record<string, string> }} input
 */
export function makeStamp({ target, gitSha, createdAt, env }) {
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

  const envFile = target === 'preview' ? PREVIEW_ENV_FILE : target === 'workersdev' ? WORKERSDEV_ENV_FILE : null
  if (!envFile) {
    console.error('usage: build-target.mjs --target preview|workersdev [--media-flag off|verified ...]')
    return 1
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
  if (target === 'workersdev') {
    const files = checkEnvFiles(findFoldedEnvFiles(root))
    if (!files.ok) {
      for (const reason of files.reasons) console.error(`refused: ${reason}`)
      return 1
    }
  }

  let buildEnv
  try {
    const fileEnv = existsSync(envFile) ? parseEnvFile(readFileSync(envFile, 'utf8')) : {}
    if (target === 'preview') {
      for (const [name, value] of Object.entries(process.env)) {
        if (name.startsWith('NEXT_PUBLIC_') && value !== undefined && !(name in fileEnv)) fileEnv[name] = value
      }
    }
    const mediaFlag = readOption(argv, '--media-flag') ?? 'off'
    const options = { mediaFlag, mediaOrigin: readOption(argv, '--media-origin') }
    if (target === 'workersdev' && mediaFlag === 'verified') {
      const reportPath = readOption(argv, '--verify-report')
      if (!reportPath) throw new Error('--verify-report is required with --media-flag verified')
      options.verifyReport = JSON.parse(readFileSync(reportPath, 'utf8'))
      options.manifest = loadManifestInfo(readOption(argv, '--manifest') ?? DEFAULT_MANIFEST_PATH)
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

  if (target === 'workersdev') {
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
  })
  mkdirSync(dirname(STAMP_PATH), { recursive: true })
  writeFileSync(STAMP_PATH, `${JSON.stringify(stamp, null, 2)}\n`)
  console.log(`build stamp written: target ${stamp.target}, media flag ${stamp.mediaFlag}`)
  return 0
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  process.exit(main(process.argv.slice(2)))
}
