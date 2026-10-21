import assert from 'node:assert/strict'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'
import { parseJsonc } from '../../scripts/cf/deploy-guard.mjs'
import { supabaseRateLimitStore } from '../../src/server/rate-limit-store.ts'

const ROOT = process.cwd()
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8')
const actions = read('src/app/[locale]/admin/actions.ts')

function bodyOf(name: string): string {
  const start = actions.indexOf(`export async function ${name}(`)
  assert.notEqual(start, -1, `${name} not found`)
  const next = actions.indexOf('\nexport ', start + 10)
  return actions.slice(start, next === -1 ? undefined : next)
}

const AUTO_FILL_ACTIONS = [
  'createShow',
  'updateShow',
  'restoreShow',
  'resolveConflictsAndRestore',
  'resolveRestoreConflictsAndRestore',
  'createSeason',
  'updateSeason',
  'createEpisode',
  'updateEpisode',
  'updateSiteMetadata',
  'updateAuthPageConfig',
  'updateFooterContent',
  'updatePortfolioContent',
  'upsertLegalPage',
  'upsertFaq',
]

test('wrangler.jsonc: app Worker has the AI binding; the media Worker does not', () => {
  const app = parseJsonc(read('wrangler.jsonc'))
  assert.deepEqual(app.ai, { binding: 'AI' })
  const media = parseJsonc(read('workers/media/wrangler.jsonc'))
  assert.equal(media.ai, undefined)
  for (const env of Object.values(media.env ?? {}) as Array<Record<string, unknown>>) {
    assert.equal(env.ai, undefined)
  }
})

test('WorkerEnv declares AI as a minimal run() binding', () => {
  const src = read('src/server/cloudflare.ts')
  assert.match(src, /AI\?: AiBinding/)
  assert.match(read('src/lib/arabic-text.ts'), /run\(model: string, input: unknown\): Promise<unknown>/)
})

test('every auto-fill admin action fills through the per-admin filler and reports the missing count', () => {
  assert.ok(!/import \{[^}]*\bfillArabic\b[^}]*\} from '@\/lib\/translate'/.test(actions), 'actions must not use the unthrottled fillArabic')
  assert.ok(!actions.includes('translateBatchToArabicStrict'), 'ticker goes through the filler too')
  for (const name of AUTO_FILL_ACTIONS) {
    const b = bodyOf(name)
    assert.ok(b.includes('createArabicFiller('), `${name} lacks createArabicFiller(`)
    assert.ok(b.includes('withArabicMissing('), `${name} does not report arabicMissing`)
  }
  const ticker = bodyOf('updateTopTicker')
  assert.ok(ticker.includes('createArabicFiller(user.id)'))
  assert.ok(ticker.includes('fillTickerArabic(trimmed, arabic.fillBatch, arabicMaxLengths(topTickerItemSchema))'))
})

test('the filler is created after the admin check (user id from the authenticated admin)', () => {
  for (const name of AUTO_FILL_ACTIONS) {
    const b = bodyOf(name)
    const filler = b.indexOf('createArabicFiller(')
    const guard = Math.max(b.indexOf('runAdminAction('), b.indexOf('assertAdmin()'))
    assert.ok(guard !== -1 && guard < filler, `${name}: admin check must come first`)
    assert.ok(/createArabicFiller\((ctx\.adminUserId|user\.id)\)/.test(b), `${name}: filler must take the admin id`)
  }
})

test('every form that saves an auto-fill action shows the arabic-missing warning', () => {
  for (const f of [
    'src/components/admin/show-form.tsx',
    'src/components/admin/season-form-drawer.tsx',
    'src/components/admin/episode-form-drawer.tsx',
    'src/components/admin/archive-table.tsx',
    'src/components/admin/settings/site-metadata-editor.tsx',
    'src/components/admin/settings/auth-page-editor.tsx',
    'src/components/admin/settings/footer-editor.tsx',
    'src/components/admin/settings/portfolio-tab.tsx',
    'src/components/admin/settings/legal-pages-editor.tsx',
    'src/components/admin/settings/faqs-editor.tsx',
  ]) {
    assert.ok(read(f).includes('useArabicMissingToast('), `${f} lacks the warning toast`)
  }
})

test('arabicAutoFillMissing uses the signed ticker copy, EN and AR', () => {
  for (const lang of ['en', 'ar']) {
    const m = JSON.parse(read(`src/messages/${lang}.json`))
    assert.equal(m.admin.common.arabicAutoFillMissing, m.admin.settings.newsTickerArabicMissing, lang)
  }
})

function walk(dir: string, out: string[] = []): string[] {
  if (!existsSync(dir)) return out
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.next' || name === '.open-next') continue
    const p = join(dir, name)
    if (statSync(p).isDirectory()) walk(p, out)
    else out.push(p)
  }
  return out
}

test('the Google Translate path is gone from src, scripts, tests and .env.example', () => {
  const banned = ['GOOGLE_TRANSLATE' + '_API_KEY', 'translation.' + 'googleapis']
  const hits: string[] = []
  const files = [...walk(join(ROOT, 'src')), ...walk(join(ROOT, 'scripts')), ...walk(join(ROOT, 'tests')), join(ROOT, '.env.example')]
  for (const f of files) {
    if (!existsSync(f)) continue
    const text = readFileSync(f, 'utf8')
    for (const b of banned) if (text.includes(b)) hits.push(`${f}: ${b}`)
  }
  assert.deepEqual(hits, [])
})

test('next dev keeps remote bindings off (no live Workers AI from a dev server)', () => {
  assert.match(read('next.config.ts'), /initOpenNextCloudflareForDev\(\{\s*remoteBindings: false\s*\}\)/)
})

// ---- shared rate_limits store ---------------------------------------------

function fakeAdmin(opts: { count?: number | null; countError?: boolean; insertError?: boolean } = {}) {
  const seen: Array<Record<string, unknown>> = []
  const client = {
    from(table: string) {
      return {
        select(_cols: string, o: unknown) {
          const q = { table, op: 'count', o, eq: undefined as unknown, gte: undefined as unknown }
          seen.push(q)
          const chain = {
            eq(col: string, v: unknown) { q.eq = [col, v]; return chain },
            gte(col: string, v: unknown) {
              q.gte = [col, v]
              return Promise.resolve({ count: opts.count === undefined ? 4 : opts.count, error: opts.countError ? { message: 'x' } : null })
            },
          }
          return chain
        },
        insert(row: unknown) {
          seen.push({ table, op: 'insert', row })
          return Promise.resolve({ error: opts.insertError ? { message: 'x' } : null })
        },
      }
    },
  }
  return { client, seen }
}

test('supabaseRateLimitStore folds the ip into the key and throws on errors', async () => {
  const { client, seen } = fakeAdmin()
  const store = supabaseRateLimitStore(client)
  assert.equal(await store.count('admin:u1', 'translate-ar', '2026-10-20T00:00:00.000Z'), 4)
  await store.record('admin:u1', 'translate-ar')
  assert.deepEqual(seen[0]!.eq, ['key', 'translate-ar:admin:u1'])
  assert.deepEqual(seen[0]!.gte, ['created_at', '2026-10-20T00:00:00.000Z'])
  assert.deepEqual(seen[1], { table: 'rate_limits', op: 'insert', row: { key: 'translate-ar:admin:u1' } })
  await assert.rejects(supabaseRateLimitStore(fakeAdmin({ countError: true }).client).count('i', 'k', 's'))
  await assert.rejects(supabaseRateLimitStore(fakeAdmin({ count: null }).client).count('i', 'k', 's'))
  await assert.rejects(supabaseRateLimitStore(fakeAdmin({ insertError: true }).client).record('i', 'k'))
})

test('contact form still uses the shared store with its own key shape', () => {
  const src = read('src/app/actions/contact.ts')
  assert.ok(src.includes('supabaseRateLimitStore(createAdminClient())'))
})
