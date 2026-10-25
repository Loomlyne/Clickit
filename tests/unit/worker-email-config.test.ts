// Queue wiring of the email consumer (Phase 5, plan 05-19; D-28, D-36, D-38, F9).
// Source and config assertions only: custom-worker.ts has a queue() handler over
// the pure consumer, wrangler.jsonc declares the clickit-email producer, consumer
// and DLQ with the Free-plan limits and the public email vars, and the consumer's
// import graph stays React-free (05-11 pre-render, T-05-19-04).

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseJsonc } from '../../scripts/cf/deploy-guard.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
type Json = Record<string, unknown>

const workerSrc = readFileSync(resolve(ROOT, 'custom-worker.ts'), 'utf8')
const wrangler = parseJsonc(readFileSync(resolve(ROOT, 'wrangler.jsonc'), 'utf8')) as Json
const production = ((wrangler.env as Json | undefined)?.production ?? {}) as Json

// ---------------------------------------------------------------------------
// custom-worker.ts
// ---------------------------------------------------------------------------

test('custom-worker.ts has a queue() handler over processBatch and buildEmailDeps', () => {
  assert.match(workerSrc, /async queue\(/)
  assert.match(workerSrc, /from '\.\/src\/server\/email\/consumer\.ts'/)
  assert.match(workerSrc, /from '\.\/src\/server\/email\/deps\.ts'/)
  assert.match(workerSrc, /processBatch\(batch, buildEmailDeps\(/)
  assert.match(workerSrc, /CLICKIT_RUNTIME: 'workers'/)
})

test('custom-worker.ts uses no @/ alias and no server-only', () => {
  assert.doesNotMatch(workerSrc, /from '@\//)
  assert.doesNotMatch(workerSrc, /server-only/)
})

test('queue() lets errors propagate (no catch, no waitUntil), so the queue retries the batch', () => {
  const start = workerSrc.indexOf('async queue(')
  assert.ok(start >= 0)
  const next = workerSrc.indexOf('async scheduled(', start)
  // Comments stripped: the scheduled() comment above its handler mentions waitUntil.
  const body = workerSrc
    .slice(start, next > start ? next : undefined)
    .replace(/^\s*\/\/.*$/gm, '')
  assert.match(body, /await processBatch\(/)
  assert.equal(/catch\s*\(/.test(body), false)
  assert.equal(/waitUntil/.test(body), false)
})

// ---------------------------------------------------------------------------
// wrangler.jsonc
// ---------------------------------------------------------------------------

const EXPECTED_QUEUES = {
  producers: [{ binding: 'EMAIL_QUEUE', queue: 'clickit-email' }],
  consumers: [
    {
      queue: 'clickit-email',
      max_batch_size: 5,
      max_batch_timeout: 5,
      max_retries: 5,
      retry_delay: 60,
      dead_letter_queue: 'clickit-email-dlq',
    },
  ],
}

test('wrangler.jsonc declares the clickit-email producer, consumer and DLQ (D-28, D-38)', () => {
  assert.deepEqual(wrangler.queues, EXPECTED_QUEUES)
})

test('env.production repeats the queues block (wrangler does not inherit it)', () => {
  assert.deepEqual(production.queues, EXPECTED_QUEUES)
})

test('vars hold the public email settings and no secret', () => {
  for (const vars of [wrangler.vars, production.vars] as Array<Record<string, string>>) {
    assert.equal(vars.EMAIL_FROM, 'Clickit Story <no-reply@clickitstory.ae>')
    assert.match(vars.SUPABASE_URL ?? '', /^https:\/\/[a-z0-9]+\.supabase\.co$/)
    assert.equal(vars.SITE_ORIGIN, 'https://www.clickitstory.ae')
    assert.equal(vars.EMAIL_DIGEST_ENABLED, 'off')
    for (const secret of ['RESEND_API_KEY', 'EMAIL_LINK_SECRET', 'SUPABASE_SERVICE_ROLE_KEY']) {
      assert.equal(secret in vars, false, `${secret} must be a Worker secret, not a var`)
    }
    for (const name of Object.keys(vars)) {
      assert.doesNotMatch(name, /KEY|SECRET/, `${name} looks like a secret`)
    }
  }
})

test('triggers.crons is untouched by this plan (top level stays empty; 05-20 owns the cron)', () => {
  assert.deepEqual((wrangler.triggers as { crons: string[] }).crons, [])
})

test('.dev.vars.example lists the email secret names with empty values', () => {
  const lines = readFileSync(resolve(ROOT, '.dev.vars.example'), 'utf8').split('\n')
  for (const name of ['RESEND_API_KEY', 'EMAIL_LINK_SECRET', 'SUPABASE_SERVICE_ROLE_KEY']) {
    assert.ok(lines.includes(`${name}=`), `${name}= (empty) listed`)
  }
  for (const line of lines) {
    if (line.startsWith('#') || line.trim() === '') continue
    assert.match(line, /^[A-Z0-9_]+=$/, `names only: ${line.split('=')[0]}`)
  }
})

// ---------------------------------------------------------------------------
// Import allow-list of the consumer path (T-05-19-04)
// ---------------------------------------------------------------------------

// Bare specifiers allowed besides node:*. Empty in 05-19.
const ALLOWED_BARE: string[] = []

// Every file the consumer path may reach. Extending it needs a one-line reason here
// and in the plan SUMMARY; never react*, @react-email/*, src/emails/components.ts,
// src/emails/app/templates.ts, src/emails/app/direct.ts or src/emails/messages/*.
const ALLOWED_FILES = new Set([
  'src/server/email/consumer.ts',
  'src/server/email/deps.ts',
  'src/server/email/transport.ts',
  'src/server/email/links.ts',
  'src/emails/render-app.ts',
  'src/emails/app/model.ts',
  'src/emails/app/template-fill.ts',
  'src/emails/brand.ts',
  'src/lib/email-tokens.ts',
  'src/lib/email-constants.ts',
  'src/generated/app-email-templates.json',
])

/** Whole-line // comments first (they may mention "@react-email/*"), then blocks. */
function stripComments(src: string): string {
  return src.replace(/^\s*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '')
}

/** import ... from 's', export ... from 's', import 's', import('s'); a trailing `with { ... }` is ignored. */
function specifiers(src: string): string[] {
  const code = stripComments(src)
  const out: string[] = []
  const patterns = [
    /(?:^|[\s;])(?:import|export)\s[^'"]*?\bfrom\s*['"]([^'"]+)['"]/g,
    /(?:^|[\s;])import\s*['"]([^'"]+)['"]/g,
    /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
  ]
  for (const source of patterns) {
    for (const m of code.matchAll(new RegExp(source.source, source.flags))) out.push(m[1]!)
  }
  return out
}

function walk(entries: string[]): Set<string> {
  const seen = new Set<string>()
  const queue = entries.map((e) => resolve(ROOT, e))
  while (queue.length) {
    const file = queue.shift()!
    const rel = relative(ROOT, file)
    if (seen.has(rel)) continue
    seen.add(rel)
    if (file.endsWith('.json')) continue
    for (const spec of specifiers(readFileSync(file, 'utf8'))) {
      if (spec.startsWith('.')) {
        queue.push(resolve(dirname(file), spec))
      } else if (!spec.startsWith('node:') && !ALLOWED_BARE.includes(spec)) {
        assert.fail(`bare import '${spec}' in ${rel} is not allowed on the consumer path`)
      }
    }
  }
  return seen
}

test('consumer entries come from custom-worker.ts', () => {
  const fromWorker = specifiers(workerSrc).filter((s) => s.startsWith('./src/server/email/'))
  assert.deepEqual([...fromWorker].sort(), ['./src/server/email/consumer.ts', './src/server/email/deps.ts'])
})

test('import allow-list: the consumer path stays on Worker-safe, React-free files', () => {
  const entries = specifiers(workerSrc)
    .filter((s) => s.startsWith('./src/server/email/'))
    .map((s) => s.slice(2))
  const visited = walk(entries)
  for (const file of visited) {
    assert.ok(ALLOWED_FILES.has(file), `${file} is outside the consumer allow-list`)
  }
  assert.ok(visited.has('src/emails/render-app.ts'), 'render-app.ts reached')
  assert.ok(visited.has('src/generated/app-email-templates.json'), 'pre-rendered JSON reached')
  for (const file of visited) {
    assert.doesNotMatch(file, /components\.ts$|app\/templates\.ts$|app\/direct\.ts$|emails\/messages\//)
  }
})

test('import walker follows every import form, including with { type: json }', () => {
  const src = [
    "import a from './a.ts'",
    "import type { B } from './b.ts'",
    "import {\n  c,\n  d,\n} from './c.ts'",
    "export { e } from './e.ts'",
    "import './f.ts'",
    "const g = await import('./g.ts')",
    "import h from './h.json' with { type: 'json' }",
    "// import x from 'react'",
    "/* import y from '@react-email/render' */",
  ].join('\n')
  assert.deepEqual(specifiers(src).sort(), [
    './a.ts',
    './b.ts',
    './c.ts',
    './e.ts',
    './f.ts',
    './g.ts',
    './h.json',
  ])
})
