import 'server-only'

import { getWorkerEnv } from '@/server/cloudflare'
import type { QueueLike } from '@/server/cloudflare'
import { processBatch } from './consumer.ts'
import type { MessageLike } from './consumer.ts'
import { buildEmailDeps } from './deps.ts'

// The producer's queue port (D-28; 05-16). In the Worker it is the EMAIL_QUEUE binding.
// Outside the Worker (next dev, e2e) an in-process queue runs the same processBatch with
// the Mailpit mailer. Production must never fall back: when CLICKIT_RUNTIME is 'workers'
// a missing binding throws (T-05-16-03).

const LOG_PREFIX = '[email/queue-local]'

function createInProcessQueue(): QueueLike {
  const sendBatch: QueueLike['sendBatch'] = async (messages) => {
    // Fire and forget: the outbox row and the sweep are the record, like the real queue.
    const batch = {
      messages: messages.map(
        (m): MessageLike => ({
          body: m.body,
          ack() {},
          retry() {},
        })
      ),
    }
    const deps = buildEmailDeps({
      ...process.env,
      SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
      SITE_ORIGIN: process.env.NEXT_PUBLIC_SITE_URL,
    })
    void processBatch(batch, deps).catch(() => {
      console.error(`${LOG_PREFIX} processBatch failed`)
    })
  }
  return { send: (body) => sendBatch([{ body }]), sendBatch }
}

async function workerQueue(): Promise<QueueLike | undefined> {
  try {
    return (await getWorkerEnv()).EMAIL_QUEUE
  } catch {
    // No Cloudflare context (plain Node: next dev without the platform proxy, tests).
    return undefined
  }
}

export async function getEmailQueue(): Promise<QueueLike> {
  const bound = await workerQueue()
  if (bound) return bound
  if (process.env.CLICKIT_RUNTIME === 'workers')
    throw new Error('EMAIL_QUEUE binding missing')
  return createInProcessQueue()
}
