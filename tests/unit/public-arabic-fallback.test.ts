// Review item 6/10 (PR #29): a public /ar render never calls Workers AI. A missing *_ar
// shows the English; the AI runs only inside admin saves (per-admin filler, rate limited).
import assert from 'node:assert/strict'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'
import { localizedField } from '../../src/lib/locale.ts'

const ROOT = process.cwd()
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8')

// The context @opennextjs/cloudflare puts on the global scope: a binding here is what
// getWorkerAi() would find on a live Worker.
const CONTEXT = Symbol.for('__cloudflare-context__')

function withFakeWorkerAi<T>(fn: (calls: () => number) => Promise<T>): Promise<T> {
  let calls = 0
  const g = globalThis as unknown as Record<symbol, unknown>
  const before = g[CONTEXT]
  g[CONTEXT] = {
    env: {
      AI: {
        async run() {
          calls += 1
          return { choices: [{ message: { content: 'نص عربي' }, finish_reason: 'stop' }] }
        },
      },
    },
    ctx: {},
    cf: {},
  }
  return fn(() => calls).finally(() => {
    g[CONTEXT] = before
  })
}

test('localizedField: /ar with a null or blank *_ar returns the English, no AI call', async () => {
  await withFakeWorkerAi(async (calls) => {
    assert.equal(await localizedField('ar', 'The Majlis', null), 'The Majlis')
    assert.equal(await localizedField('ar', 'The Majlis', undefined), 'The Majlis')
    assert.equal(await localizedField('ar', 'The Majlis', '   '), 'The Majlis')
    assert.equal(await localizedField('ar', 'The Majlis', 'المجلس'), 'المجلس')
    assert.equal(await localizedField('en', 'The Majlis', 'المجلس'), 'The Majlis')
    assert.equal(await localizedField('ar', '', null), '')
    assert.equal(calls(), 0)
  })
})

test('queries.ts renders stored Arabic only: no translate import, localizedField from locale', () => {
  const q = read('src/lib/queries.ts')
  assert.ok(!q.includes("from '@/lib/translate'"), 'queries.ts must not import the translator')
  assert.ok(!/translateEnToAr|translateBatchToArabic|translateToArabic\b/.test(q))
  assert.ok(!/export async function localizedField/.test(q), 'localizedField lives in src/lib/locale.ts')
  assert.match(q, /import \{[^}]*\blocalizedField\b[^}]*\} from '@\/lib\/locale'/)
})

test('translate.ts keeps only the strict admin API (no public non-strict exports, no cache)', () => {
  const t = read('src/lib/translate.ts')
  for (const gone of ['translateEnToAr', 'translateToArabic =', 'translateBatchToArabic(', 'unstable_cache']) {
    assert.ok(!t.includes(gone), `translate.ts still has ${gone}`)
  }
  for (const kept of ['export function createArabicFiller', 'export async function translateBatchToArabicStrict', 'export async function translateToArabicStrict']) {
    assert.ok(t.includes(kept), `translate.ts lost ${kept}`)
  }
})

function walk(dir: string, out: string[] = []): string[] {
  if (!existsSync(dir)) return out
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) walk(p, out)
    else if (/\.(ts|tsx)$/.test(name)) out.push(p)
  }
  return out
}

test('only the admin actions import the translator; no public file reaches Workers AI', () => {
  const importers = walk(join(ROOT, 'src'))
    .filter((f) => /from '@\/lib\/translate'|from '\.\.?\/(lib\/)?translate'/.test(readFileSync(f, 'utf8')))
    .map((f) => f.slice(ROOT.length + 1))
  assert.deepEqual(importers, ['src/app/[locale]/admin/actions.ts'])
  const aiUsers = walk(join(ROOT, 'src'))
    .filter((f) => readFileSync(f, 'utf8').includes('getWorkerAi('))
    .map((f) => f.slice(ROOT.length + 1))
    .sort()
  assert.deepEqual(aiUsers, ['src/lib/translate.ts', 'src/server/cloudflare.ts'])
})
