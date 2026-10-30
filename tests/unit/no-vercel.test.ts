// Plan 02-14 guard (PLAT-06 / PLAT-10): no Vercel or BotID artefact in code,
// config or dependencies. Comments that only mention the word "Vercel" are
// allowed (Phase 8 rewrites docs and comments). scripts/cf/ is excluded because
// the deploy guard names VERCEL in order to refuse it.
import assert from 'node:assert/strict'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('../../', import.meta.url))
const SKIP_DIRS = new Set(['node_modules', '.next', '.open-next', '.wrangler', '.planning', '.claude', '.git', '.audit', '.tmp'])
const CODE_EXT = /\.(ts|tsx|js|jsx|mjs|cjs|mts|cts|sh|json|jsonc)$/

// Kept until Phase 3 (plan 02-09 open decision): the Supabase storage range
// proxy still sets Vercel-CDN-Cache-Control, a no-op header off Vercel.
const ALLOWED_FILES = new Set(['src/lib/storage-range-proxy.ts'])

const BANNED = [
  'botid',
  '@vercel/',
  'VERCEL_URL',
  'VERCEL_PROJECT_PRODUCTION_URL',
  'vercel-scripts',
  'vercel-insights',
  'vercel.live',
  '.env.vercel',
  '.vercel/',
  'Vercel-CDN-Cache-Control',
]
// Uppercase VERCEL is an env-var name (VERCEL, VERCEL_ENV, ...): no code fallback.
const BANNED_ENV = /\bVERCEL(_[A-Z_]+)?\b/

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue
    const full = join(dir, name)
    if (statSync(full).isDirectory()) walk(full, out)
    else if (CODE_EXT.test(name)) out.push(full)
  }
  return out
}

function rel(path: string): string {
  return relative(ROOT, path).split('\\').join('/')
}

test('Vercel config files are gone', () => {
  for (const file of ['.vercelignore', 'scripts/check-cron.sh']) {
    assert.equal(existsSync(join(ROOT, file)), false, `${file} must not exist`)
  }
})

// Koss, 2026-10-30: www followed main, so vercel.json may exist only as the
// off-switch for Vercel Git deploys, until it is deleted at the Worker cutover.
test('vercel.json, if present, only turns Vercel Git deploys off', () => {
  const file = join(ROOT, 'vercel.json')
  if (!existsSync(file)) return
  assert.deepEqual(JSON.parse(readFileSync(file, 'utf8')), { git: { deploymentEnabled: false } })
})

test('package.json has no botid or @vercel/ dependency', () => {
  const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'))
  const names = Object.keys({ ...pkg.dependencies, ...pkg.devDependencies, ...pkg.optionalDependencies })
  const bad = names.filter((n) => n === 'botid' || n.startsWith('@vercel/'))
  assert.deepEqual(bad, [])
})

test('package-lock.json has no botid or @vercel/ package', () => {
  const lock = JSON.parse(readFileSync(join(ROOT, 'package-lock.json'), 'utf8'))
  const bad = Object.keys(lock.packages ?? {}).filter((k) => /node_modules\/(botid|@vercel\/)/.test(k))
  assert.deepEqual(bad, [])
})

test('src/, scripts/ and next.config.ts carry no Vercel or BotID artefact', () => {
  const files = [
    ...walk(join(ROOT, 'src')),
    ...walk(join(ROOT, 'scripts')).filter((f) => !rel(f).startsWith('scripts/cf/')),
    join(ROOT, 'next.config.ts'),
  ]
  assert.ok(files.length > 20, 'scan found too few files')
  const hits: string[] = []
  for (const file of files) {
    const name = rel(file)
    const text = readFileSync(file, 'utf8')
    for (const needle of BANNED) {
      if (ALLOWED_FILES.has(name) && needle === 'Vercel-CDN-Cache-Control') continue
      if (text.toLowerCase().includes(needle.toLowerCase())) hits.push(`${name}: ${needle}`)
    }
    if (BANNED_ENV.test(text)) hits.push(`${name}: VERCEL env name`)
  }
  assert.deepEqual(hits, [])
})

test('wrangler configs do not mention vercel', () => {
  for (const file of ['wrangler.jsonc', 'workers/media/wrangler.jsonc']) {
    const path = join(ROOT, file)
    if (!existsSync(path)) continue
    assert.doesNotMatch(readFileSync(path, 'utf8'), /vercel/i, file)
  }
})

test('the repo root has no Vercel-named file', () => {
  const bad = readdirSync(ROOT).filter((n) => /vercel/i.test(n) && n !== '.vercel' && n !== 'vercel.json')
  assert.deepEqual(bad, [])
})
