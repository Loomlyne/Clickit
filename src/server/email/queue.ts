import 'server-only'

import { getWorkerEnv } from '@/server/cloudflare'
import type { QueueLike } from '@/server/cloudflare'
import { selectEmailQueue } from './queue-select.ts'
import type { LocalQueueLoader } from './queue-select.ts'

// The producer's queue port (D-28; 05-16). In the Worker it is the EMAIL_QUEUE binding.
// Outside the Worker (next dev, next start, e2e) an in-process queue runs the same
// processBatch with the Mailpit mailer. Production must never fall back: a missing
// binding throws (T-05-16-03).
//
// process.env.CLICKIT_WORKER_BUILD is replaced at build time by next.config.ts
// compiler.defineServer. The cf:build scripts set it to "1", so Turbopack folds the
// branch below and emits no chunk for the fallback (the Worker uploads every chunk,
// and the fallback would carry a second copy of the consumer and the email templates).
// Under next dev and next start it is "", and the fallback loads lazily. Keep the
// import() a literal expression: a variable path or a helper defined elsewhere would
// stop Turbopack from dropping the chunk.
const loadLocal: LocalQueueLoader =
  process.env.CLICKIT_WORKER_BUILD === '1'
    ? null
    : async () => (await import('./queue-local.ts')).createInProcessQueue()

async function workerQueue(): Promise<QueueLike | undefined> {
  try {
    return (await getWorkerEnv()).EMAIL_QUEUE
  } catch {
    // No Cloudflare context (plain Node: next dev without the platform proxy, tests).
    return undefined
  }
}

export async function getEmailQueue(): Promise<QueueLike> {
  return selectEmailQueue({
    bound: await workerQueue(),
    runtime: process.env.CLICKIT_RUNTIME,
    loadLocal,
  })
}
