import 'server-only'

import { createAdminClient } from '@/lib/supabase/admin'
import type { Json } from '@/lib/database.types'
import { enqueueEmailCore } from './enqueue-core.ts'
import type { EnqueueInput, EnqueueResult } from './enqueue-core.ts'
import { getEmailQueue } from './queue.ts'

export type { EnqueueInput, EnqueueResult }

/**
 * The one way to send an app email (D-28). Writes the outbox row through the
 * enqueue_email RPC first, then rings the queue with { outboxId }. A queue failure never
 * fails the caller (the 15-minute sweep re-enqueues); an RPC failure throws so the
 * caller decides what to report.
 */
export async function enqueueEmail(
  input: EnqueueInput
): Promise<EnqueueResult> {
  const admin = createAdminClient()
  return enqueueEmailCore(input, {
    rpc: async (args) => {
      const { data, error } = await admin.rpc('enqueue_email', {
        ...args,
        // The core validated it as a plain object; Json is the generated column type.
        p_payload: args.p_payload as Json,
      })
      if (error) throw new Error(`enqueue_email failed: ${error.message}`)
      return (data ?? []) as { id: string | null; outcome: string }[]
    },
    queue: await getEmailQueue(),
    log: console,
  })
}
