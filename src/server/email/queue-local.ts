import 'server-only'

import type { QueueLike } from '@/server/cloudflare'
import { processBatch } from './consumer.ts'
import type { MessageLike } from './consumer.ts'
import { buildEmailDeps } from './deps.ts'

// The in-process email queue (next dev, next start, e2e). Reached only through the
// dynamic import in queue.ts, and never in a cf:build: the Worker bundle must not
// carry a second copy of the consumer and the app email templates (custom-worker.ts
// queue() already has them).

const LOG_PREFIX = '[email/queue-local]'

export function createInProcessQueue(): QueueLike {
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
