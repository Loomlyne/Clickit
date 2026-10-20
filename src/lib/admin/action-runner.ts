// One runner for every admin server action: assertAdmin -> core -> cache
// revalidation in a finally. Pure seam: no next/*, server-only or '@/' imports,
// so node --test can load it. Sibling imports are type-only.
import type { AdminDb, AuditWriter } from './ports'

export type AdminActionEnv = {
  assertAdmin: () => Promise<{ id: string }>
  createDb: () => AdminDb
  audit: AuditWriter
  logError: (label: string, err: unknown) => void
}

type RunCtx = { db: AdminDb; adminUserId: string; audit: AuditWriter }

const messageOf = (err: unknown, fallback: string) =>
  err instanceof Error ? err.message : fallback

export async function runAdminAction<R extends { success: boolean; wrote?: boolean }>(
  env: AdminActionEnv,
  run: (ctx: RunCtx) => Promise<R>,
  opts: {
    fallbackError: string
    revalidate: (result: R | undefined) => void | Promise<void>
  }
): Promise<R | { success: false; error: string }> {
  let user: { id: string }
  try {
    user = await env.assertAdmin()
  } catch (err) {
    env.logError('[admin/actions] mutation failed', err)
    return { success: false, error: messageOf(err, opts.fallbackError) }
  }

  let result: R | undefined
  let thrown: { error: string } | undefined
  try {
    result = await run({
      db: env.createDb(),
      adminUserId: user.id,
      audit: env.audit,
    })
  } catch (err) {
    env.logError('[admin/actions] mutation failed', err)
    thrown = { error: messageOf(err, opts.fallbackError) }
  } finally {
    // A thrown run may have written something, so it revalidates too.
    if (!result || result.success || result.wrote === true) {
      try {
        await opts.revalidate(result)
      } catch (err) {
        env.logError('[admin/actions] revalidate failed', err)
      }
    }
  }
  if (thrown) return { success: false, error: thrown.error }
  return result as R
}
