import assert from 'node:assert/strict'
import test from 'node:test'
import {
  runWithCompensation,
  compensationAuditDiff,
  pendingAuditDiff,
  newAttemptId,
  runAuditedDelete,
} from '../../src/lib/admin/compensation.ts'
import { createFakeSupabase } from './helpers/fake-supabase.ts'

type Res = { error: string | null }
const ok = async (): Promise<Res> => ({ error: null })
const bad = (msg = 'boom') => async (): Promise<Res> => ({ error: msg })

function step(name: string, log: string[], opts: { fail?: boolean; undoFail?: boolean; noUndo?: boolean; throws?: boolean } = {}) {
  return {
    name,
    run: async (): Promise<Res> => {
      log.push(`run:${name}`)
      if (opts.throws) throw new Error('thrown ' + name)
      return opts.fail ? { error: `fail ${name}` } : { error: null }
    },
    undo: opts.noUndo
      ? undefined
      : async (): Promise<Res> => {
          log.push(`undo:${name}`)
          return opts.undoFail ? { error: `undo fail ${name}` } : { error: null }
        },
  }
}

test('all steps succeed', async () => {
  const log: string[] = []
  const r = await runWithCompensation([step('a', log), step('b', log), step('c', log)])
  assert.deepEqual(r, { ok: true, completed: ['a', 'b', 'c'], wrote: true })
})

test('middle step fails: earlier undone, later never run', async () => {
  const log: string[] = []
  const r = await runWithCompensation([step('a', log), step('b', log, { fail: true }), step('c', log)])
  assert.equal(r.ok, false)
  if (r.ok) return
  assert.equal(r.failedStep, 'b')
  assert.equal(r.error, 'fail b')
  assert.deepEqual(r.undone, ['a'])
  assert.deepEqual(r.leftInPlace, [])
  assert.equal(r.wrote, true)
  assert.deepEqual(log, ['run:a', 'run:b', 'undo:a'])
})

test('first step fails: wrote true, nothing undone', async () => {
  const log: string[] = []
  const r = await runWithCompensation([step('a', log, { fail: true })])
  assert.equal(r.ok, false)
  if (r.ok) return
  assert.equal(r.wrote, true)
  assert.deepEqual(r.undone, [])
})

test('empty list', async () => {
  assert.deepEqual(await runWithCompensation([]), { ok: true, completed: [], wrote: false })
})

test('undo failure is reported in leftInPlace, never thrown', async () => {
  const log: string[] = []
  const r = await runWithCompensation([step('a', log, { undoFail: true }), step('b', log, { fail: true })])
  assert.equal(r.ok, false)
  if (r.ok) return
  assert.deepEqual(r.undone, [])
  assert.deepEqual(r.leftInPlace, [{ step: 'a', error: 'undo fail a' }])
})

test('thrown step treated as error', async () => {
  const log: string[] = []
  const r = await runWithCompensation([step('a', log), step('b', log, { throws: true })])
  assert.equal(r.ok, false)
  if (r.ok) return
  assert.equal(r.failedStep, 'b')
  assert.match(r.error, /thrown b/)
  assert.deepEqual(r.undone, ['a'])
})

test('undo runs in reverse order', async () => {
  const log: string[] = []
  const r = await runWithCompensation([
    step('a', log),
    step('b', log),
    step('c', log),
    step('d', log, { fail: true }),
  ])
  assert.equal(r.ok, false)
  if (r.ok) return
  assert.deepEqual(r.undone, ['c', 'b', 'a'])
  assert.deepEqual(log.filter((l) => l.startsWith('undo')), ['undo:c', 'undo:b', 'undo:a'])
})

test('completed step without undo is left in place', async () => {
  const log: string[] = []
  const r = await runWithCompensation([step('a', log, { noUndo: true }), step('b', log, { fail: true })])
  assert.equal(r.ok, false)
  if (r.ok) return
  assert.deepEqual(r.leftInPlace, [{ step: 'a', error: 'no undo defined' }])
})

test('audit diff builders', () => {
  const id = newAttemptId()
  assert.match(id, /^[0-9a-f-]{36}$/)
  assert.deepEqual(pendingAuditDiff({ id: 'x' }, id), { outcome: 'pending', attempt_id: id, id: 'x' })
  assert.deepEqual(
    compensationAuditDiff({ ok: true, completed: ['a'], wrote: true }, { id: 'x' }, id),
    { outcome: 'committed', attempt_id: id, id: 'x' }
  )
  assert.deepEqual(
    compensationAuditDiff(
      { ok: false, failedStep: 'b', error: 'e', undone: ['a'], leftInPlace: [], completed: [], wrote: true } as any,
      { id: 'x' }
    ),
    { outcome: 'failed', failed_step: 'b', error: 'e', undone: ['a'], left_in_place: [], id: 'x' }
  )
})

function deleteInput(f: ReturnType<typeof createFakeSupabase>) {
  const c = f.client as any
  return {
    audit: f.auditWriter,
    adminUserId: 'u1',
    action: 'delete' as const,
    entity: 'episode' as const,
    entityId: 'e1',
    context: { id: 'e1', title: 'Ep' },
    steps: [
      {
        name: 'delete episode',
        run: async () => {
          const { error } = await c.from('episodes').delete().eq('id', 'e1')
          return { error: error ? error.message : null }
        },
      },
    ],
  }
}
const seed = () =>
  createFakeSupabase({ episodes: [{ id: 'e1', season_id: 's', episode_number: 1 }] })

test('runAuditedDelete success: pending then committed, same attempt_id', async () => {
  const f = seed()
  const r = await runAuditedDelete(deleteInput(f))
  assert.equal(r.ok, true)
  assert.equal(r.wrote, true)
  const rows = f.auditRows()
  assert.equal(rows.length, 2)
  assert.equal(rows[0].diff.outcome, 'pending')
  assert.equal(rows[1].diff.outcome, 'committed')
  assert.equal(rows[0].diff.attempt_id, rows[1].diff.attempt_id)
  assert.equal(rows[0].diff.attempt_id, r.attemptId)
  assert.equal(f.tables.episodes.length, 0)
})

test('runAuditedDelete delete fails: pending then failed with details', async () => {
  const f = seed()
  f.failOn({ table: 'episodes', op: 'delete', nth: 1 })
  const r = await runAuditedDelete(deleteInput(f))
  assert.equal(r.ok, false)
  assert.equal(r.wrote, true)
  const rows = f.auditRows()
  assert.equal(rows.length, 2)
  assert.equal(rows[0].diff.outcome, 'pending')
  assert.equal(rows[1].diff.outcome, 'failed')
  assert.equal(rows[1].diff.attempt_id, rows[0].diff.attempt_id)
  assert.equal(rows[1].diff.failed_step, 'delete episode')
  assert.equal(rows[1].diff.error, 'forced failure')
  assert.deepEqual(rows[1].diff.undone, [])
  assert.deepEqual(rows[1].diff.left_in_place, [])
  assert.equal(f.tables.episodes.length, 1)
})

test('runAuditedDelete refuses to delete when pending audit insert fails', async () => {
  const f = seed()
  f.failOn({ table: 'admin_audit_log', op: 'insert', nth: 1 })
  const r = await runAuditedDelete(deleteInput(f))
  assert.equal(r.ok, false)
  assert.equal(r.wrote, false)
  assert.equal(r.error, 'Could not write the audit record; nothing was deleted.')
  assert.equal(f.calls.some((c) => c.op === 'delete'), false)
  assert.equal(f.tables.episodes.length, 1)
})

test('runAuditedDelete delete ok but terminal audit fails: honest message', async () => {
  const f = seed()
  f.failOn({ table: 'admin_audit_log', op: 'insert', nth: 2 })
  const r = await runAuditedDelete(deleteInput(f))
  assert.equal(r.ok, false)
  assert.equal(r.wrote, true)
  assert.match(r.error!, /deleted/i)
  assert.match(r.error!, /audit/i)
  const pending = f.auditRows()[0]
  assert.ok(r.error!.includes(pending.diff.attempt_id))
  assert.equal(f.tables.episodes.length, 0)
})
