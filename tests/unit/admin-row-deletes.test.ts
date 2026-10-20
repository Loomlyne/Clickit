import assert from 'node:assert/strict'
import test from 'node:test'
import { ROW_DELETE, deleteRowAuditedCore } from '../../src/lib/admin/row-deletes.ts'
import { createFakeSupabase } from './helpers/fake-supabase.ts'

const id = (p: string, n = 0) => `${p.repeat(8)}-0000-4000-8000-${String(n).padStart(12, '0')}`
const SHOW = id('a')
const LEGAL = id('b')
const FAQ = id('c')
const REVIEW = id('d')
const SHORT = id('e')

function world() {
  const f = createFakeSupabase({
    shows: [{ id: SHOW, title: 'Doctor Care' }],
    legal_pages: [{ id: LEGAL, slug: 'terms', title: 'Terms', title_ar: 'الشروط', content: 'Body EN', content_ar: 'نص', sort_order: 1 }],
    faqs: [{ id: FAQ, question: 'How?', question_ar: null, answer: 'Like this', answer_ar: 'هكذا', sort_order: 0 }],
    reviews: [{ id: REVIEW, show_id: SHOW, user_id: 'user-9', stars: 2, body: 'Too short', created_at: '2026-10-01' }],
    shorts: [{ id: SHORT, title: 'Clip', youtube_video_id: 'abc', channel_name: 'C', is_featured: false, archived: false }],
  })
  return { f, deps: { audit: f.auditWriter, adminUserId: 'admin-1' } }
}

const CASES = [
  { spec: ROW_DELETE.legalPage, table: 'legal_pages', rowId: LEGAL, entity: 'legal_page', key: 'slug', value: 'terms' },
  { spec: ROW_DELETE.faq, table: 'faqs', rowId: FAQ, entity: 'faq', key: 'question', value: 'How?' },
  { spec: ROW_DELETE.review, table: 'reviews', rowId: REVIEW, entity: 'review', key: 'body', value: 'Too short' },
  { spec: ROW_DELETE.short, table: 'shorts', rowId: SHORT, entity: 'short', key: 'title', value: 'Clip' },
] as const

for (const c of CASES) {
  test(`${c.entity}: malformed id is refused, nothing read or written`, async () => {
    const { f, deps } = world()
    const r = await deleteRowAuditedCore(f.client, deps, c.spec, 'nope')
    assert.equal(r.success, false)
    assert.equal(r.wrote, false)
    assert.equal(f.calls.length, 0)
  })

  test(`${c.entity}: a missing row is refused without an audit row`, async () => {
    const { f, deps } = world()
    const r = await deleteRowAuditedCore(f.client, deps, c.spec, id('f'))
    assert.equal(r.success, false)
    assert.match(r.error ?? '', /not found/)
    assert.equal(f.auditRows().length, 0)
  })

  test(`${c.entity}: success writes pending before the delete and committed after, with a snapshot`, async () => {
    const { f, deps } = world()
    const r = await deleteRowAuditedCore(f.client, deps, c.spec, c.rowId)
    assert.equal(r.success, true)
    assert.equal(f.snapshot()[c.table]!.length, 0)
    const rows = f.auditRows()
    assert.deepEqual(rows.map((x) => x.diff.outcome), ['pending', 'committed'])
    assert.equal(rows[0]!.diff.attempt_id, rows[1]!.diff.attempt_id)
    for (const row of rows) {
      assert.equal(row.action_type, 'delete')
      assert.equal(row.entity_type, c.entity)
      assert.equal(row.diff.snapshot[c.key], c.value)
    }
    const auditIdx = f.calls.findIndex((x) => x.table === 'admin_audit_log' && x.op === 'insert')
    const delIdx = f.calls.findIndex((x) => x.table === c.table && x.op === 'delete')
    assert.ok(auditIdx >= 0 && auditIdx < delIdx)
  })

  test(`${c.entity}: a failed pending audit row deletes nothing`, async () => {
    const { f, deps } = world()
    f.failOn({ table: 'admin_audit_log', op: 'insert', nth: 1 })
    const r = await deleteRowAuditedCore(f.client, deps, c.spec, c.rowId)
    assert.equal(r.success, false)
    assert.equal(r.wrote, false)
    assert.equal(f.snapshot()[c.table]!.length, 1)
    assert.equal(f.calls.filter((x) => x.op === 'delete').length, 0)
  })

  test(`${c.entity}: a forced delete failure keeps the row and writes pending then failed`, async () => {
    const { f, deps } = world()
    f.failOn({ table: c.table, op: 'delete', nth: 1 })
    const r = await deleteRowAuditedCore(f.client, deps, c.spec, c.rowId)
    assert.equal(r.success, false)
    assert.equal(r.wrote, true)
    assert.equal(f.snapshot()[c.table]!.length, 1)
    assert.deepEqual(f.auditRows().map((x) => x.diff.outcome), ['pending', 'failed'])
  })
}

test('review snapshot keeps the content, the stars, the user and the show title', async () => {
  const { f, deps } = world()
  await deleteRowAuditedCore(f.client, deps, ROW_DELETE.review, REVIEW)
  const snap = f.auditRows()[1]!.diff.snapshot
  assert.equal(snap.body, 'Too short')
  assert.equal(snap.stars, 2)
  assert.equal(snap.user_id, 'user-9')
  assert.equal(snap.show_id, SHOW)
  assert.equal(snap.show_title, 'Doctor Care')
})

test('review: a failed show lookup refuses the delete, no audit row', async () => {
  const { f, deps } = world()
  f.failOn({ table: 'shows', op: 'select', nth: 1 })
  const r = await deleteRowAuditedCore(f.client, deps, ROW_DELETE.review, REVIEW)
  assert.equal(r.success, false)
  assert.equal(f.auditRows().length, 0)
  assert.equal(f.snapshot().reviews!.length, 1)
})

test('legal page and FAQ snapshots keep the full text so a hard delete stays recoverable', async () => {
  for (const col of ['content', 'content_ar', 'title', 'title_ar', 'slug']) assert.match(ROW_DELETE.legalPage.columns, new RegExp(`\\b${col}\\b`))
  for (const col of ['question', 'question_ar', 'answer', 'answer_ar']) assert.match(ROW_DELETE.faq.columns, new RegExp(`\\b${col}\\b`))
  const a = world()
  await deleteRowAuditedCore(a.f.client, a.deps, ROW_DELETE.legalPage, LEGAL)
  const legal = a.f.auditRows()[1]!.diff.snapshot
  assert.equal(legal.content, 'Body EN')
  assert.equal(legal.content_ar, 'نص')
  const b = world()
  await deleteRowAuditedCore(b.f.client, b.deps, ROW_DELETE.faq, FAQ)
  const faq = b.f.auditRows()[1]!.diff.snapshot
  assert.equal(faq.answer, 'Like this')
  assert.equal(faq.answer_ar, 'هكذا')
})
