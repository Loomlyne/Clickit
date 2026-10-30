import { NextResponse } from 'next/server'
import { cronAuthOk } from '@/server/cron-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { getWorkerEnv } from '@/server/cloudflare'
import { getEmailQueue } from '@/server/email/queue'
import { isDigestEnabled, runEmailCron } from '@/server/email/cron-core'

/**
 * The single Phase 5 cron (D-29, D-34 / Q14, MAIL-04, MAIL-07): the outbox sweep on
 * every call, plus the My List digest when EMAIL_DIGEST_ENABLED is exactly "on"
 * (wrangler var, "off" until Koss approves mail to real viewers).
 *
 * Schedule: daily 16:00 UTC = 20:00 Dubai. Auth: the Worker scheduled handler sends
 * `Authorization: Bearer ${CRON_SECRET}` (constant-time check).
 *   Local dev: curl -H "Authorization: Bearer $CRON_SECRET" \
 *     localhost:3000/api/cron/email-digest
 *
 * The response and the logs carry counts only: no ids, addresses or payloads.
 */
export const dynamic = 'force-dynamic'

const SWEEP_LIMIT = 500

async function digestFlag(): Promise<string | undefined> {
  try {
    const env = await getWorkerEnv()
    if (typeof env.EMAIL_DIGEST_ENABLED === 'string') return env.EMAIL_DIGEST_ENABLED
  } catch {
    // No Cloudflare context (next dev without the platform proxy, next start).
  }
  return process.env.EMAIL_DIGEST_ENABLED
}

function rpcIds(name: string, data: unknown, error: { message: string } | null): string[] {
  if (error) throw new Error(`${name} failed: ${error.message}`)
  return Array.isArray(data) ? data.filter((v): v is string => typeof v === 'string') : []
}

export async function GET(req: Request) {
  if (!(await cronAuthOk(req.headers.get('authorization'), process.env.CRON_SECRET))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const admin = createAdminClient()
    const digestEnabled = isDigestEnabled(await digestFlag())

    const result = await runEmailCron({
      digestEnabled,
      async sweep() {
        const { data, error } = await admin.rpc('sweep_outbox', { p_limit: SWEEP_LIMIT })
        return rpcIds('sweep_outbox', data, error)
      },
      async buildDigest() {
        const { data, error } = await admin.rpc('build_digest', {})
        return rpcIds('build_digest', data, error)
      },
      async sendBatch(messages) {
        // Called as a method: the EMAIL_QUEUE binding needs its own `this`.
        const queue = await getEmailQueue()
        await queue.sendBatch(messages)
      },
      log: console,
    })

    return NextResponse.json({
      ok: true,
      swept: result.swept,
      digest: result.digest,
      queueErrors: result.queueErrors,
    })
  } catch (err) {
    console.error(
      '[cron/email-digest] failed',
      err instanceof Error ? err.message : 'unknown',
    )
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}
