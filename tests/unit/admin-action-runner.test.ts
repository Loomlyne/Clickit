import assert from 'node:assert/strict'
import test from 'node:test'
import { runAdminAction, type AdminActionEnv } from '../../src/lib/admin/action-runner.ts'

type R = { success: boolean; wrote?: boolean; error?: string }

function setup(over: Partial<AdminActionEnv> = {}) {
  const logs: Array<[string, unknown]> = []
  let createDbCalls = 0
  const env: AdminActionEnv = {
    assertAdmin: async () => ({ id: 'admin-1' }),
    createDb: () => {
      createDbCalls++
      return {} as never
    },
    audit: async () => ({ error: null }),
    logError: (label, err) => logs.push([label, err]),
    ...over,
  }
  const reval: Array<R | undefined> = []
  const opts = {
    fallbackError: 'Fallback failure',
    revalidate: (r: R | undefined) => {
      reval.push(r)
    },
  }
  return { env, logs, reval, opts, createDbCalls: () => createDbCalls }
}

test('assertAdmin failure returns the error, skips run and revalidate, logs once', async () => {
  const s = setup({
    assertAdmin: async () => {
      throw new Error('Unauthorized')
    },
  })
  let ran = false
  const res = await runAdminAction<R>(
    s.env,
    async () => {
      ran = true
      return { success: true }
    },
    s.opts
  )
  assert.deepEqual(res, { success: false, error: 'Unauthorized' })
  assert.equal(ran, false)
  assert.equal(s.reval.length, 0)
  assert.equal(s.logs.length, 1)
  assert.equal(s.createDbCalls(), 0)
})

test('success revalidates once with the result', async () => {
  const s = setup()
  const out: R = { success: true }
  const res = await runAdminAction<R>(s.env, async () => out, s.opts)
  assert.equal(res, out)
  assert.equal(s.reval.length, 1)
  assert.equal(s.reval[0], out)
})

test('partial failure with wrote true still revalidates', async () => {
  const s = setup()
  const res = await runAdminAction<R>(
    s.env,
    async () => ({ success: false, wrote: true, error: 'half' }),
    s.opts
  )
  assert.equal(res.success, false)
  assert.equal(s.reval.length, 1)
})

test('refusal with wrote false does not revalidate', async () => {
  const s = setup()
  await runAdminAction<R>(s.env, async () => ({ success: false, wrote: false }), s.opts)
  assert.equal(s.reval.length, 0)
})

test('run throwing an Error returns its message, revalidates with undefined, logs', async () => {
  const s = setup()
  const res = await runAdminAction<R>(
    s.env,
    async () => {
      throw new Error('boom')
    },
    s.opts
  )
  assert.deepEqual(res, { success: false, error: 'boom' })
  assert.equal(s.reval.length, 1)
  assert.equal(s.reval[0], undefined)
  assert.equal(s.logs[0]![0], '[admin/actions] mutation failed')
})

test('run throwing a non-Error returns the fallback error', async () => {
  const s = setup()
  const res = await runAdminAction<R>(
    s.env,
    async () => {
      throw 'nope'
    },
    s.opts
  )
  assert.deepEqual(res, { success: false, error: 'Fallback failure' })
})

test('revalidate throwing keeps the action result and logs the revalidate error', async () => {
  const s = setup()
  const out: R = { success: true }
  const boom = new Error('cache down')
  const res = await runAdminAction<R>(s.env, async () => out, {
    fallbackError: 'x',
    revalidate: () => {
      throw boom
    },
  })
  assert.equal(res, out)
  assert.ok(s.logs.some(([, e]) => e === boom))
})

test('run receives db, admin id and the audit writer', async () => {
  const s = setup()
  let seen: { id: string; hasAudit: boolean } | null = null
  await runAdminAction<R>(
    s.env,
    async (ctx) => {
      seen = { id: ctx.adminUserId, hasAudit: ctx.audit === s.env.audit }
      return { success: true }
    },
    s.opts
  )
  assert.deepEqual(seen, { id: 'admin-1', hasAudit: true })
})
