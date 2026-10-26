// Core of the single Phase 5 cron (D-29, D-34 / Q14, MAIL-04, MAIL-07). Pure: no
// imports, so it runs under node --test. The route /api/cron/email-digest injects the
// sweep_outbox and build_digest RPCs and the EMAIL_QUEUE sendBatch.
//
// Order:
// 1. sweep_outbox always runs. It returns outbox rows whose queue message was lost
//    (pending > 15 min, retrying past next_attempt_at, expired lease). An error throws,
//    so the route answers 500 and the Worker's cron status shows the failure.
// 2. build_digest runs only when EMAIL_DIGEST_ENABLED is exactly "on" (T-05-20-02:
//    off until Koss approves mail to real viewers). An error is rethrown after the swept
//    ids are sent, so a digest failure never holds back the resends.
// 3. Every id goes to the queue as { outboxId } in batches of at most 100 (the Queues
//    sendBatch limit). A failed batch is counted, never thrown: its rows stay pending
//    and the next sweep picks them up.
//
// Logs carry counts only, never ids, addresses or payloads.

export const QUEUE_BATCH_MAX = 100
const LOG_PREFIX = '[cron/email-digest]'

export type EmailCronMessage = { body: { outboxId: string } }

export type EmailCronPorts = {
  digestEnabled: boolean
  sweep(): Promise<string[]>
  buildDigest(): Promise<string[]>
  sendBatch(messages: EmailCronMessage[]): Promise<void>
  log: { log(message: string): void; error(message: string): void }
}

export type EmailCronResult = {
  swept: number
  digest: number | 'disabled'
  queueErrors: number
}

/** The digest flag is on only for the exact string "on"; anything else is off. */
export function isDigestEnabled(value: string | null | undefined): boolean {
  return value === 'on'
}

async function sendAll(ids: string[], ports: EmailCronPorts): Promise<number> {
  let errors = 0
  for (let start = 0; start < ids.length; start += QUEUE_BATCH_MAX) {
    const chunk = ids.slice(start, start + QUEUE_BATCH_MAX)
    try {
      await ports.sendBatch(chunk.map((outboxId) => ({ body: { outboxId } })))
    } catch {
      errors += 1
      ports.log.error(`${LOG_PREFIX} queue send failed, sweep will retry size=${chunk.length}`)
    }
  }
  return errors
}

export async function runEmailCron(ports: EmailCronPorts): Promise<EmailCronResult> {
  const swept = await ports.sweep()

  let digestIds: string[] = []
  let digestError: unknown = null
  if (ports.digestEnabled) {
    try {
      digestIds = await ports.buildDigest()
    } catch (err) {
      digestError = err
    }
  }

  const unique = [...new Set([...swept, ...digestIds])]
  const queueErrors = await sendAll(unique, ports)

  if (digestError !== null) throw digestError

  const digest: EmailCronResult['digest'] = ports.digestEnabled ? digestIds.length : 'disabled'
  ports.log.log(`${LOG_PREFIX} swept=${swept.length} digest=${digest} queueErrors=${queueErrors}`)
  return { swept: swept.length, digest, queueErrors }
}
