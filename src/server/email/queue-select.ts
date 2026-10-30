import type { QueueLike } from '../cloudflare.ts'

// Pure decision for getEmailQueue() (quick-261026-nad). No 'server-only' and no '@/'
// imports so it runs under node --test.
//
// - A bound EMAIL_QUEUE always wins.
// - loadLocal is null in a Worker build (CLICKIT_WORKER_BUILD=1): there is no in-process
//   fallback in that bundle, so a missing binding fails closed.
// - runtime 'workers' also fails closed (T-05-16-03): production never falls back.
// - Otherwise (next dev, next start, tests) the in-process queue is loaded lazily.

export type LocalQueueLoader = (() => Promise<QueueLike>) | null

export async function selectEmailQueue(input: {
  bound: QueueLike | undefined
  runtime: string | undefined
  loadLocal: LocalQueueLoader
}): Promise<QueueLike> {
  if (input.bound) return input.bound
  if (input.loadLocal === null) throw new Error('EMAIL_QUEUE binding missing')
  if (input.runtime === 'workers') throw new Error('EMAIL_QUEUE binding missing')
  return await input.loadLocal()
}
