import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { runAdminAction, type AdminActionEnv } from '../../src/lib/admin/action-runner.ts'
import {
  FAQ_DELETE,
  LEGAL_PAGE_DELETE,
  REVIEW_DELETE,
  SHORT_DELETE,
  deleteRowAuditedCore,
} from '../../src/lib/admin/legacy-deletes.ts'
import { createFakeSupabase } from './helpers/fake-supabase.ts'

const LP = '11111111-1111-4111-8111-111111111111'
const FQ = '22222222-2222-4222-8222-222222222222'
const RV = '33333333-3333-4333-8333-333333333333'
const SH = '44444444-4444-4444-8444-444444444444'
const MISSING = '99999999-9999-4999-8999-999999999999'
const SHOW = '55555555-5555-4555-8555-555555555555'
const USER = '66666666-6666-4666-8666-666666666666'

function world() {
  return createFakeSupabase({
    legal_pages: [
      { id: LP, slug: 'terms', title: 'Terms', title_ar: 'الشروط', content: 'Be nice.', content_ar: 'كن لطيفا.', sort_order: 0 },
    ],
    faqs: [{ id: FQ, question: 'Free?', question_ar: 'مجاني؟', answer: 'Yes.', answer_ar: 'نعم.', sort_order: 0 }],
    reviews: [{ id: RV, show_id: SHOW, user_id: USER, stars: 2, body: 'Too long.' }],
    shorts: [{ id: SH, title: 'Clip', youtube_video_id: 'abcdefghijk', channel_name: 'CIT', archived: false }],
  })
}

type Fake = ReturnType<typeof world>
const deps = (f: Fake) => ({ adminUserId: 'admin-1', audit: f.auditWriter.bind(f) })

const CASES = [
  { name: 'deleteLegalPage', spec: LEGAL_PAGE_DELETE, id: LP, entity: 'legal_page',
    snapshot: { slug: 'terms', title: 'Terms', title_ar: 'الشروط', content: 'Be nice.', content_ar: 'كن لطيفا.' } },
  { name: 'deleteFaq', spec: FAQ_DELETE, id: FQ, entity: 'faq',
    snapshot: { question: 'Free?', question_ar: 'مجاني؟', answer: 'Yes.', answer_ar: 'نعم.' } },
  { name: 'deleteReview', spec: REVIEW_DELETE, id: RV, entity: 'review',
    snapshot: { show_id: SHOW, user_id: USER, stars: 2, body: 'Too long.' } },
  { name: 'deleteShort', spec: SHORT_DELETE, id: SH, entity: 'short',
    snapshot: { title: 'Clip', youtube_video_id: 'abcdefghijk', channel_name: 'CIT', archived: false } },
] as const

for (const c of CASES) {
  const table = c.spec.table

  test(`${c.name}: pending row before the delete, committed row after, same attempt_id and snapshot`, async () => {
    const f = world()
    const r = await deleteRowAuditedCore(f.client, deps(f), c.spec, c.id)
    assert.equal(r.success, true)
    assert.equal(r.wrote, true)
    assert.equal(f.tables[table]!.length, 0)
    const rows = f.auditRows()
    assert.equal(rows.length, 2)
    for (const row of rows) {
      assert.equal(row.action_type, 'delete')
      assert.equal(row.entity_type, c.entity)
      assert.equal(row.entity_id, c.id)
      assert.deepEqual(row.diff.snapshot, c.snapshot)
    }
    assert.equal(rows[0]!.diff.outcome, 'pending')
    assert.equal(rows[1]!.diff.outcome, 'committed')
    assert.equal(rows[0]!.diff.attempt_id, rows[1]!.diff.attempt_id)
    const auditIdx = f.calls.findIndex((x) => x.table === 'admin_audit_log' && x.op === 'insert')
    const delIdx = f.calls.findIndex((x) => x.table === table && x.op === 'delete')
    assert.ok(auditIdx >= 0 && auditIdx < delIdx)
  })

  test(`${c.name}: failed pending row deletes nothing`, async () => {
    const f = world()
    f.failOn({ table: 'admin_audit_log', op: 'insert', nth: 1 })
    const r = await deleteRowAuditedCore(f.client, deps(f), c.spec, c.id)
    assert.equal(r.success, false)
    assert.equal(r.wrote, false)
    assert.equal(r.error, 'Could not write the audit record; nothing was deleted.')
    assert.equal(f.tables[table]!.length, 1)
    assert.equal(f.calls.filter((x) => x.table === table && x.op === 'delete').length, 0)
  })

  test(`${c.name}: forced delete failure keeps the row, pending then failed`, async () => {
    const f = world()
    f.failOn({ table, op: 'delete', nth: 1 })
    const r = await deleteRowAuditedCore(f.client, deps(f), c.spec, c.id)
    assert.equal(r.success, false)
    assert.equal(r.wrote, true)
    assert.equal(f.tables[table]!.length, 1)
    assert.deepEqual(f.auditRows().map((x) => x.diff.outcome), ['pending', 'failed'])
  })

  test(`${c.name}: unknown id is refused, no audit row`, async () => {
    const f = world()
    const r = await deleteRowAuditedCore(f.client, deps(f), c.spec, MISSING)
    assert.equal(r.success, false)
    assert.equal(r.wrote, false)
    assert.equal(r.error, c.spec.notFound)
    assert.equal(f.auditRows().length, 0)
  })

  test(`${c.name}: malformed id is refused before any db call`, async () => {
    const f = world()
    const r = await deleteRowAuditedCore(f.client, deps(f), c.spec, 'not-a-uuid')
    assert.equal(r.success, false)
    assert.equal(r.wrote, false)
    assert.equal(f.calls.length, 0)
  })
}

test('closing audit row failure after the delete is reported, pending row remains', async () => {
  const f = world()
  f.failOn({ table: 'admin_audit_log', op: 'insert', nth: 2 })
  const r = await deleteRowAuditedCore(f.client, deps(f), FAQ_DELETE, FQ)
  assert.equal(r.success, false)
  assert.equal(r.wrote, true)
  assert.match(r.error!, /closing audit row could not be written/)
  assert.equal(f.tables.faqs!.length, 0)
  assert.deepEqual(f.auditRows().map((x) => x.diff.outcome), ['pending'])
})

function env(f: Fake, admin = true): AdminActionEnv {
  return {
    assertAdmin: async () => {
      if (!admin) throw new Error('Not authorized')
      return { id: 'admin-1' }
    },
    createDb: () => f.client,
    audit: f.auditWriter.bind(f),
    logError: () => {},
  }
}

test('runner path, not admin: no db call, no audit row, no revalidate', async () => {
  const f = world()
  let revalidated = 0
  const r = await runAdminAction(
    env(f, false),
    (ctx) => deleteRowAuditedCore(ctx.db, { audit: ctx.audit, adminUserId: ctx.adminUserId }, REVIEW_DELETE, RV),
    { fallbackError: 'x', revalidate: () => void (revalidated += 1) }
  )
  assert.equal(r.success, false)
  assert.equal(f.calls.length, 0)
  assert.equal(revalidated, 0)
})

test('runner path, unknown id: refused and not revalidated', async () => {
  const f = world()
  let revalidated = 0
  const r = await runAdminAction(
    env(f),
    (ctx) => deleteRowAuditedCore(ctx.db, { audit: ctx.audit, adminUserId: ctx.adminUserId }, SHORT_DELETE, MISSING),
    { fallbackError: 'x', revalidate: () => void (revalidated += 1) }
  )
  assert.equal(r.success, false)
  assert.equal(revalidated, 0)
})

const src = readFileSync('src/app/[locale]/admin/actions.ts', 'utf8')
function bodyOf(name: string): string {
  const start = src.indexOf(`export async function ${name}(`)
  assert.ok(start >= 0, `${name} export missing`)
  const next = src.indexOf('\nexport ', start + 10)
  return src.slice(start, next === -1 ? undefined : next)
}

for (const [name, spec] of [
  ['deleteLegalPage', 'LEGAL_PAGE_DELETE'],
  ['deleteFaq', 'FAQ_DELETE'],
  ['deleteReview', 'REVIEW_DELETE'],
  ['deleteShort', 'SHORT_DELETE'],
] as const) {
  test(`source scan: ${name} runs deleteRowAuditedCore(${spec}) through runAdminAction`, () => {
    const body = bodyOf(name)
    assert.ok(body.includes('runAdminAction('))
    assert.ok(body.includes('deleteRowAuditedCore('))
    assert.ok(body.includes(spec))
    assert.equal(body.includes('.delete()'), false, `${name} still deletes directly`)
  })
}
