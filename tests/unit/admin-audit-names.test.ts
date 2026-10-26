import assert from 'node:assert/strict'
import test from 'node:test'
import { auditActorLabel } from '../../src/server/admin-names.ts'
import {
  runAdminAction,
  type AdminActionEnv,
} from '../../src/lib/admin/action-runner.ts'
import type { AuditArgs } from '../../src/lib/audit.ts'

const names = new Map([['a', 'Issam']])

test('known admin id gives the display name', () => {
  assert.deepEqual(auditActorLabel('a', names), { kind: 'name', text: 'Issam' })
})

test('id with no admins row is a former admin', () => {
  assert.deepEqual(auditActorLabel('gone', names), { kind: 'former' })
})

test('null, undefined or empty id is System', () => {
  assert.deepEqual(auditActorLabel(null, names), { kind: 'system' })
  assert.deepEqual(auditActorLabel(undefined, names), { kind: 'system' })
  assert.deepEqual(auditActorLabel('', names), { kind: 'system' })
})

test('owner script rows are labelled Owner script, not the affected admin', () => {
  assert.deepEqual(
    auditActorLabel('a', names, { count: 2, by: 'owner script' }),
    {
      kind: 'owner_script',
    }
  )
  assert.deepEqual(
    auditActorLabel('gone', names, { count: 1, by: 'owner script' }),
    {
      kind: 'owner_script',
    }
  )
})

test('a diff without by, or with an empty by, keeps the normal rules', () => {
  assert.deepEqual(auditActorLabel('a', names, { count: 2 }), {
    kind: 'name',
    text: 'Issam',
  })
  assert.deepEqual(auditActorLabel('a', names, { count: 2, by: '' }), {
    kind: 'name',
    text: 'Issam',
  })
  assert.deepEqual(auditActorLabel('gone', names, { by: '' }), {
    kind: 'former',
  })
  assert.deepEqual(auditActorLabel(null, names, null), { kind: 'system' })
})

test("the admin's own enrol-restart row stays attributed to that admin", () => {
  // 05-25 writes { count, status: 'unverified', by: 'enrol restart' } with the
  // acting admin's own id; only the owner script marks a different actor.
  assert.deepEqual(
    auditActorLabel('a', names, {
      count: 1,
      status: 'unverified',
      by: 'enrol restart',
    }),
    { kind: 'name', text: 'Issam' }
  )
})

test('an empty or blank display name falls back to Former admin, never a blank cell', () => {
  const blank = new Map([['a', '  ']])
  assert.deepEqual(auditActorLabel('a', blank), { kind: 'former' })
})

test('runAdminAction writes the audit row with the id requireAdmin returned', async () => {
  const audited: AuditArgs[] = []
  const env: AdminActionEnv = {
    assertAdmin: async () =>
      ({ id: 'u1', email: 'x', displayName: 'Nejib' }) as { id: string },
    createDb: () => ({}) as never,
    audit: async (entry) => {
      audited.push(entry)
      return { error: null }
    },
    logError: () => {},
  }
  const res = await runAdminAction(
    env,
    async (ctx) => {
      const { error } = await ctx.audit({
        adminUserId: ctx.adminUserId,
        action: 'update',
        entity: 'show',
        entityId: 's1',
        diff: { changed: { title: 'x' } },
      })
      return { success: error === null, wrote: true }
    },
    { fallbackError: 'x', revalidate: () => {} }
  )
  assert.equal(res.success, true)
  assert.equal(audited.length, 1)
  assert.equal(audited[0]!.adminUserId, 'u1')
})
