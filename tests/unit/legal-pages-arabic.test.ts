// Review item 12 (PR #29), Koss 2026-10-21 (question form): legal pages Arabic = "AI draft,
// admin approves". AI Arabic is stored as an unpublished draft; /ar shows the English legal
// text until an admin ticks "Arabic reviewed" and saves. Also item 8: the update is a
// compare-and-swap on updated_at.
import assert from 'node:assert/strict'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import test from 'node:test'
import { scanSql } from '../../scripts/migration-guard.mjs'
import {
  LEGAL_REVIEW_REQUIRED,
  legalArabicForEditor,
  upsertLegalPageCore,
  type LegalPageRow,
} from '../../src/lib/admin/legal-pages.ts'
import { INVALID_UPDATED_AT, SAVE_CONFLICT } from '../../src/lib/admin/row-version.ts'
import { legalPageForLocale } from '../../src/lib/legal-arabic.ts'
import { createFakeSupabase } from './helpers/fake-supabase.ts'

const ID = '7d0b1c2e-3f40-4a5b-8c6d-7e8f90a1b2c3'
const V1 = '2026-10-20T10:00:00.000001+00:00'

function row(over: Partial<LegalPageRow> = {}): LegalPageRow {
  return {
    id: ID,
    slug: 'terms-of-use',
    title: 'Terms of Use',
    content: 'Be kind.',
    title_ar: null,
    content_ar: null,
    title_ar_draft: null,
    content_ar_draft: null,
    ar_reviewed: false,
    sort_order: 1,
    updated_at: V1,
    ...over,
  }
}

/** A fake filler: translates by prefixing, records every call. */
function filler() {
  const calls: Array<{ en: string | null | undefined; max?: number }> = []
  return {
    calls,
    fill: async (en: string | null | undefined, ar: string | null | undefined, max?: number) => {
      if (ar?.trim()) return ar.trim()
      if (!en?.trim()) return null
      calls.push({ en, max })
      return `مسودة ${en}`
    },
  }
}

function db(r: LegalPageRow | null = row()) {
  return createFakeSupabase({ legal_pages: r ? [r] : [] }, { updatedAtTables: ['legal_pages'] })
}

const input = (over: Record<string, unknown> = {}) => ({
  id: ID,
  slug: 'terms-of-use',
  title: 'Terms of Use',
  content: 'Be kind.',
  title_ar: '',
  content_ar: '',
  ar_reviewed: false,
  sort_order: 1,
  ...over,
})

// ---- public render -----------------------------------------------------------

test('public: /ar shows the Arabic only when ar_reviewed; drafts never', () => {
  const published = row({ title_ar: 'شروط الاستخدام', content_ar: 'كن لطيفا.', ar_reviewed: true })
  assert.deepEqual(legalPageForLocale(published, 'ar'), { title: 'شروط الاستخدام', content: 'كن لطيفا.' })
  assert.deepEqual(legalPageForLocale(published, 'en'), { title: 'Terms of Use', content: 'Be kind.' })
  const unreviewed = row({ title_ar: 'شروط', content_ar: 'قديم', content_ar_draft: 'مسودة', ar_reviewed: false })
  assert.deepEqual(legalPageForLocale(unreviewed, 'ar'), { title: 'Terms of Use', content: 'Be kind.' })
  const blank = row({ ar_reviewed: true, content_ar: '  ' })
  assert.deepEqual(legalPageForLocale(blank, 'ar'), { title: 'Terms of Use', content: 'Be kind.' })
  assert.deepEqual(legalPageForLocale({ ...row(), ar_reviewed: undefined } as never, 'ar'), { title: 'Terms of Use', content: 'Be kind.' })
})

test('editor shows the published Arabic when reviewed, else the draft (or the old published text)', () => {
  assert.deepEqual(legalArabicForEditor(row({ title_ar: 'أ', content_ar: 'ب', content_ar_draft: 'ج', ar_reviewed: true })), { title_ar: 'أ', content_ar: 'ب' })
  assert.deepEqual(legalArabicForEditor(row({ title_ar: 'أ', content_ar: 'ب', content_ar_draft: 'ج' })), { title_ar: 'أ', content_ar: 'ج' })
  assert.deepEqual(legalArabicForEditor(row()), { title_ar: '', content_ar: '' })
})

// ---- admin save --------------------------------------------------------------

test('new page, Arabic blank: AI writes the DRAFT columns, never the published ones', async () => {
  const f = db(null)
  const ar = filler()
  const res = await upsertLegalPageCore(f.client, { fill: ar.fill }, input({ id: undefined }))
  assert.equal(res.success, true, res.error)
  const saved = f.tables.legal_pages![0]!
  assert.equal(saved.title_ar_draft, 'مسودة Terms of Use')
  assert.equal(saved.content_ar_draft, 'مسودة Be kind.')
  assert.equal(saved.title_ar ?? null, null)
  assert.equal(saved.content_ar ?? null, null)
  assert.equal(saved.ar_reviewed, false)
  assert.equal(ar.calls.find((c) => c.en === 'Terms of Use')?.max, 200, 'title draft obeys the 200 max')
})

test('ticked with an empty Arabic body is refused before any write or AI call', async () => {
  const f = db()
  const ar = filler()
  const before = f.snapshot()
  const res = await upsertLegalPageCore(f.client, { fill: ar.fill }, input({ ar_reviewed: true }), V1)
  assert.equal(res.success, false)
  assert.equal(res.error, LEGAL_REVIEW_REQUIRED)
  assert.equal(ar.calls.length, 0)
  assert.deepEqual(f.snapshot(), before)
})

test('ticked: the reviewed Arabic is published, drafts cleared, updatedAt returned', async () => {
  const f = db(row({ content_ar_draft: 'مسودة Be kind.', title_ar_draft: 'مسودة Terms of Use' }))
  const ar = filler()
  const res = await upsertLegalPageCore(
    f.client,
    { fill: ar.fill },
    input({ title_ar: 'شروط الاستخدام', content_ar: 'كن لطيفا.', ar_reviewed: true }),
    V1
  )
  assert.equal(res.success, true, res.error)
  const saved = f.tables.legal_pages![0]!
  assert.equal(saved.content_ar, 'كن لطيفا.')
  assert.equal(saved.title_ar, 'شروط الاستخدام')
  assert.equal(saved.content_ar_draft, null)
  assert.equal(saved.title_ar_draft, null)
  assert.equal(saved.ar_reviewed, true)
  assert.equal(ar.calls.length, 0)
  assert.equal(res.updatedAt, saved.updated_at)
  assert.notEqual(res.updatedAt, V1)
  assert.equal(res.data?.ar_reviewed, true)
})

test('unticked: edited Arabic stays a draft; the published Arabic is left as it was (hidden)', async () => {
  const f = db(row({ content_ar: 'قديم', ar_reviewed: true }))
  const res = await upsertLegalPageCore(f.client, { fill: filler().fill }, input({ content_ar: 'نص معدل', title_ar: 'شروط' }), V1)
  assert.equal(res.success, true, res.error)
  const saved = f.tables.legal_pages![0]!
  assert.equal(saved.content_ar_draft, 'نص معدل')
  assert.equal(saved.title_ar_draft, 'شروط')
  assert.equal(saved.content_ar, 'قديم')
  assert.equal(saved.ar_reviewed, false)
})

test('English changed, Arabic not edited: review resets and the Arabic is re-drafted', async () => {
  const f = db(row({ content_ar: 'كن لطيفا.', title_ar: 'شروط الاستخدام', ar_reviewed: true }))
  const ar = filler()
  // The form showed the published Arabic and the ticked box; only the English body changed.
  const res = await upsertLegalPageCore(
    f.client,
    { fill: ar.fill },
    input({ content: 'Be kind. Be fair.', title_ar: 'شروط الاستخدام', content_ar: 'كن لطيفا.', ar_reviewed: true }),
    V1
  )
  assert.equal(res.success, true, res.error)
  const saved = f.tables.legal_pages![0]!
  assert.equal(saved.ar_reviewed, false)
  assert.equal(saved.content_ar_draft, 'مسودة Be kind. Be fair.')
  // Title English unchanged: its Arabic is kept (as the draft title), not re-translated.
  assert.equal(saved.title_ar_draft, 'شروط الاستخدام')
  assert.deepEqual(ar.calls.map((c) => c.en), ['Be kind. Be fair.'])
  assert.deepEqual(legalPageForLocale(saved as LegalPageRow, 'ar'), { title: 'Terms of Use', content: 'Be kind. Be fair.' })
})

test('English changed and the Arabic edited too: ticked publishes', async () => {
  const f = db(row({ content_ar: 'كن لطيفا.', ar_reviewed: true }))
  const res = await upsertLegalPageCore(
    f.client,
    { fill: filler().fill },
    input({ content: 'Be kind. Be fair.', content_ar: 'كن لطيفا. كن عادلا.', ar_reviewed: true }),
    V1
  )
  assert.equal(res.success, true, res.error)
  const saved = f.tables.legal_pages![0]!
  assert.equal(saved.ar_reviewed, true)
  assert.equal(saved.content_ar, 'كن لطيفا. كن عادلا.')
})

test('a draft row saved unchanged keeps its draft and makes no AI call', async () => {
  const f = db(row({ content_ar_draft: 'مسودة', title_ar_draft: 'عنوان' }))
  const ar = filler()
  const res = await upsertLegalPageCore(f.client, { fill: ar.fill }, input({ title_ar: 'عنوان', content_ar: 'مسودة', sort_order: 3 }), V1)
  assert.equal(res.success, true, res.error)
  assert.equal(ar.calls.length, 0)
  assert.equal(f.tables.legal_pages![0]!.content_ar_draft, 'مسودة')
  assert.equal(f.tables.legal_pages![0]!.sort_order, 3)
})

test('update: stale updated_at is the conflict line, nothing written, no AI call', async () => {
  const f = db()
  const ar = filler()
  const before = f.snapshot()
  const res = await upsertLegalPageCore(f.client, { fill: ar.fill }, input(), '2026-10-19T10:00:00.000001+00:00')
  assert.equal(res.success, false)
  assert.equal(res.error, SAVE_CONFLICT)
  assert.equal(ar.calls.length, 0)
  assert.deepEqual(f.snapshot(), before)
})

test('update: a save that lands between the read and the write still conflicts (atomic CAS)', async () => {
  const f = db()
  const ar = {
    fill: async (en: string | null | undefined) => {
      // Another admin saves while the translation runs.
      f.tables.legal_pages![0]!.updated_at = '2026-10-20T10:00:05.000001+00:00'
      return en ? `مسودة ${en}` : null
    },
  }
  const res = await upsertLegalPageCore(f.client, ar, input(), V1)
  assert.equal(res.success, false)
  assert.equal(res.error, SAVE_CONFLICT)
  const upd = f.calls.find((c) => c.op === 'update')
  assert.ok(upd?.filters.some((x) => x.kind === 'eq' && x.col === 'updated_at' && x.value === V1))
})

test('update: missing or malformed updated_at is refused before any read', async () => {
  for (const bad of [undefined, '', 'yesterday']) {
    const f = db()
    const res = await upsertLegalPageCore(f.client, { fill: filler().fill }, input(), bad)
    assert.equal(res.error, INVALID_UPDATED_AT)
    assert.equal(f.calls.length, 0)
  }
})

// ---- wiring --------------------------------------------------------------------

const read = (p: string) => readFileSync(p, 'utf8')

test('public legal routes render through legalPageForLocale; the query reads ar_reviewed, not the drafts', () => {
  for (const p of [
    'src/app/[locale]/(viewer)/legal/[slug]/page.tsx',
    'src/app/[locale]/(viewer)/privacy/page.tsx',
    'src/app/[locale]/(viewer)/terms/page.tsx',
  ]) {
    const s = read(p)
    assert.ok(s.includes('legalPageForLocale('), `${p} must use legalPageForLocale`)
    assert.ok(!/pickLocalized\([^)]*content_ar/.test(s), `${p} must not pick content_ar directly`)
  }
  const q = read('src/lib/queries.ts')
  const legal = q.slice(q.indexOf('export type PublicLegalPage'))
  assert.match(legal, /ar_reviewed/)
  assert.ok(!legal.includes('_draft'), 'public reads never select the draft columns')
})

test('upsertLegalPage goes through the core with the per-admin filler and the page version', () => {
  const a = read('src/app/[locale]/admin/actions.ts')
  const start = a.indexOf('export async function upsertLegalPage(')
  const body = a.slice(start, a.indexOf('\nexport ', start + 10))
  assert.match(body, /expectedUpdatedAt/)
  assert.match(body, /upsertLegalPageCore\(/)
  assert.match(body, /createArabicFiller\(user\.id\)/)
  assert.match(body, /withArabicMissing\(/)
  assert.match(a, /title_ar_draft, content_ar_draft, ar_reviewed/, 'getLegalPages reads the draft columns for the editor')
})

test('editor: Arabic reviewed checkbox, draft Arabic in the fields, page version sent', () => {
  const e = read('src/components/admin/settings/legal-pages-editor.tsx')
  assert.match(e, /t\('legalArReviewedLabel'\)/)
  assert.match(e, /<Checkbox/)
  assert.match(e, /legalArabicForEditor\(/)
  assert.match(e, /upsertLegalPage\([^)]*expected/)
  assert.match(e, /useRowVersions\(/)
  for (const lang of ['en', 'ar']) {
    const m = JSON.parse(read(`src/messages/${lang}.json`))
    assert.equal(typeof m.admin.settings.legalArReviewedLabel, 'string', lang)
  }
  assert.equal(JSON.parse(read('src/messages/en.json')).admin.settings.legalArReviewedLabel, 'Arabic reviewed')
})

test('the DeepL backfill script only writes legal drafts, never published legal Arabic', () => {
  const s = read('scripts/backfill-translations.mjs')
  const legal = s.slice(s.indexOf("'legal_pages',"))
  assert.match(legal.slice(0, 200), /\['content', 'content_ar_draft'\]/)
  assert.ok(!/\['content', 'content_ar'\]/.test(legal.slice(0, 200)))
})

// ---- migration -----------------------------------------------------------------

const MIGRATION = 'supabase/migrations/20261021120000_legal_pages_arabic_review.sql'

test('migration: additive draft columns + ar_reviewed, existing Arabic stays published, date kept', () => {
  assert.ok(existsSync(MIGRATION))
  const names = readdirSync('supabase/migrations').filter((n) => n.endsWith('.sql')).sort()
  // Newest migration, bar a later phase's own: Phase 3 MEDIA-08 backup table (plan 03-05);
  // Phase 5 onward names its migrations `_phaseN_` (M1a, M1b).
  assert.deepEqual(
    names.filter((n) => n > '20261021120000_legal_pages_arabic_review.sql' && !/_phase\d+_/.test(n)),
    ['20261021143410_media_url_rewrite_backup.sql'],
    'newest migration (bar later phases)'
  )
  const sql = read(MIGRATION)
  assert.deepEqual(scanSql(sql).findings, [], 'no destructive SQL (guard D-04)')
  assert.deepEqual(scanSql(sql).unterminated ?? [], [])
  assert.match(sql, /add column if not exists title_ar_draft text/)
  assert.match(sql, /add column if not exists content_ar_draft text/)
  assert.match(sql, /add column if not exists ar_reviewed boolean not null default false/)
  assert.match(sql, /set ar_reviewed = true\s+where content_ar is not null and btrim\(content_ar\) <> ''/)
  // The backfill must not move the public "last updated" date.
  const off = sql.indexOf('disable trigger set_updated_at')
  const upd = sql.indexOf('set ar_reviewed = true')
  const on = sql.indexOf('enable trigger set_updated_at')
  assert.ok(off !== -1 && off < upd && upd < on)
})

test('migration: one explicit transaction holds the trigger pause, the backfill and the re-enable', () => {
  const sql = read(MIGRATION)
  const code = sql
    .split('\n')
    .map((l) => l.replace(/--.*$/, '').trim())
    .filter(Boolean)
    .join('\n')
  assert.equal((code.match(/^begin;$/gm) ?? []).length, 1, 'one begin;')
  assert.equal((code.match(/^commit;$/gm) ?? []).length, 1, 'one commit;')
  assert.ok(code.startsWith('begin;'), 'begin; is the first statement (psql runs the whole file atomically too)')
  assert.ok(code.endsWith('commit;'), 'commit; is the last statement')
  const begin = code.indexOf('begin;')
  const off = code.indexOf('disable trigger set_updated_at')
  const upd = code.indexOf('set ar_reviewed = true')
  const on = code.indexOf('enable trigger set_updated_at')
  const commit = code.indexOf('commit;')
  assert.ok(begin < off && off < upd && upd < on && on < commit)
  assert.ok(!/\brollback\b|\bsavepoint\b/i.test(code))
})

// ---- draft privacy (PR #29 re-review item 1) -----------------------------------
// legal_pages had a table-wide SELECT grant for anon and authenticated, so the draft columns
// were readable with the anon key. The migration swaps it for a column grant that leaves the
// two draft columns out; a column REVOKE alone does nothing while the table grant exists.

const DRAFT_COLUMNS = ['title_ar_draft', 'content_ar_draft']
/** Every legal_pages column except the drafts: what anon and authenticated may select. */
const PUBLIC_LEGAL_COLUMNS = [
  'id', 'slug', 'title', 'content', 'sort_order', 'created_at', 'updated_at',
  'title_ar', 'content_ar', 'ar_reviewed',
]

function legalRowColumns(): string[] {
  const t = read('src/lib/database.types.ts')
  const block = t.slice(t.indexOf('legal_pages: {'), t.indexOf('Insert:', t.indexOf('legal_pages: {')))
  return [...block.matchAll(/^\s+(\w+)\??:/gm)].map((m) => m[1]!).filter((c) => c !== 'Row')
}

function selectList(src: string, fn: string): string[] {
  const body = src.slice(src.indexOf(`export async function ${fn}(`))
  const m = /\.select\('([^']*)'\)/.exec(body)
  assert.ok(m, `${fn} has a select list`)
  return m![1]!.split(',').map((c) => c.trim())
}

test('migration: anon and authenticated get a column grant without the draft columns', () => {
  const sql = read(MIGRATION)
  const revoke = sql.search(/^revoke select on table public\.legal_pages from anon, authenticated;$/m)
  assert.ok(revoke !== -1, 'the table-wide SELECT grant is revoked')
  const grant = /^grant select \(([^)]*)\)\s+on table public\.legal_pages to anon, authenticated;$/m.exec(sql)
  assert.ok(grant, 'a column-level SELECT grant follows')
  assert.ok(sql.indexOf('add column if not exists ar_reviewed') < revoke && revoke < grant!.index)
  const granted = grant![1]!.split(',').map((c) => c.trim()).filter(Boolean)
  assert.deepEqual([...granted].sort(), [...PUBLIC_LEGAL_COLUMNS].sort())
  for (const c of DRAFT_COLUMNS) assert.ok(!granted.includes(c), `${c} is not granted`)
  // The grant lists every column the table has, drafts excepted (schema from the types).
  assert.deepEqual(
    [...granted].sort(),
    legalRowColumns().filter((c) => !DRAFT_COLUMNS.includes(c)).sort(),
    'column grant out of step with legal_pages'
  )
  assert.ok(!/grant select on (table )?public\.legal_pages to/i.test(sql), 'no table-wide SELECT re-grant')
  assert.ok(!/to (public|anon|authenticated)[^;]*;/i.test(sql.replace(grant![0], '')), 'no other grant to the browser roles')
  // The comments say what is enforced, not "never shown".
  assert.ok(!sql.includes('Never shown publicly'))
  assert.equal((sql.match(/Not readable by anon or authenticated \(column grant\)/g) ?? []).length, 2)
})

test('public legal queries select only granted columns (a draft or new column would be refused)', () => {
  const q = read('src/lib/queries.ts')
  for (const fn of ['getLegalPageBySlug', 'getAllLegalPages']) {
    for (const c of selectList(q, fn)) assert.ok(PUBLIC_LEGAL_COLUMNS.includes(c), `${fn} selects ${c}`)
  }
})

test('admin legal reads and saves go through the service client after assertAdmin', () => {
  const a = read('src/app/[locale]/admin/actions.ts')
  const body = (name: string) => {
    const start = a.indexOf(`export async function ${name}(`)
    assert.notEqual(start, -1, name)
    return a.slice(start, a.indexOf('\nexport ', start + 10))
  }
  const get = body('getLegalPages')
  assert.match(get, /await assertAdmin\(\)/, 'getLegalPages is an exported Server Action: admin only')
  assert.match(get, /createAdminClient\(\)/)
  assert.ok(get.indexOf('assertAdmin()') < get.indexOf('createAdminClient()'))
  assert.ok(!/\bcreateClient\(/.test(get), 'the session client cannot read the drafts')
  const upsert = body('upsertLegalPage')
  assert.match(upsert, /upsertLegalPageCore\(\s*createAdminClient\(\) as unknown as AdminDb/)
  assert.ok(!/\bcreateClient\(/.test(upsert), 'the pre-read and RETURNING need the drafts')
  assert.ok(upsert.indexOf('assertAdmin()') < upsert.indexOf('createAdminClient()'))
})

test('database types carry the new columns', () => {
  const t = read('src/lib/database.types.ts')
  const legal = t.slice(t.indexOf('legal_pages: {'), t.indexOf('likes: {'))
  for (const c of ['ar_reviewed: boolean', 'ar_reviewed?: boolean', 'content_ar_draft: string | null', 'title_ar_draft: string | null', 'content_ar_draft?: string | null']) {
    assert.ok(legal.includes(c), `legal_pages types lack ${c}`)
  }
})
