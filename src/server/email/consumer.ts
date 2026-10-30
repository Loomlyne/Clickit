// Email queue consumer as a pure function with injected ports (D-28, D-38,
// RESEARCH Pattern 4, F8, F9). Pure: relative imports only (type-only here), no
// server-only, no "@/" alias, no Cloudflare or React Email types, so it loads
// under node --test and inside the Worker queue() handler alike.
//
// The queue is a doorbell. Postgres is the record: a message carries only
// { outboxId }, the address and everything else come from claimOutbox, and the
// outcome of every row is written with one finishOutbox call before any message
// is acked. Never twice comes from three layers: the SQL lease, the outbox status,
// and the Resend Idempotency-Key (24 h) plus a 23 h stale guard so a key can never
// expire under a still-retrying row.
//
// Logs carry ids and kinds only (V7/V8): never an address, subject, body, link or token.

import type { Mailer } from './transport.ts'

export const MAX_ATTEMPTS = 5
export const STALE_AFTER_HOURS = 23
const MAX_DELAY_SECONDS = 12 * 60 * 60 // Cloudflare Queues caps delaySeconds at 12 h
const LOG_PREFIX = '[email/consumer]'
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Row returned by claim_outbox (contract with 05-13). to_address is null without a confirmed email. */
export type ClaimedRow = {
  id: string
  kind: string
  idempotency_key: string
  to_address: string | null
  reply_to: string | null
  locale: string
  payload: unknown
  attempts: number
  first_attempt_at: string | null
  to_user: string | null
}

/** One element of the finish_outbox payload (contract with 05-13). */
export type FinishEntry = {
  id: string
  status: 'sent' | 'retrying' | 'failed' | 'skipped'
  provider_id?: string | null
  error?: string
  next_attempt_at?: string
}

export type Rendered = { subject: string; html: string; text: string }

export type MessageLike = {
  body: unknown
  attempts?: number
  ack(): void
  retry(options?: { delaySeconds?: number }): void
}

export type ConsumerDeps = {
  claimOutbox(ids: string[]): Promise<ClaimedRow[]>
  finishOutbox(entries: FinishEntry[]): Promise<unknown>
  /** Kept a port on purpose: this module never imports the template engine. */
  render(row: ClaimedRow): Rendered | Promise<Rendered>
  mailer: Mailer
  now(): number
  log(line: string): void
  /** Signed one-click unsubscribe URL for a user (digest only). */
  unsubscribeUrl(userId: string): Promise<string>
}

/** Seconds to wait after the nth attempt: 60, 120, 240 ... capped at 3600. */
export function backoffSeconds(attempts: number): number {
  const n = Number.isFinite(attempts) && attempts > 1 ? Math.floor(attempts) : 1
  return Math.min(60 * 2 ** Math.min(n - 1, 20), 3600)
}

const LOOPBACK_HTTP = /^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?\//

/** RFC 8058 one-click pair. Only for digest mail; the url must be a single clean https target. */
export function unsubscribeHeaders(url: string): Record<string, string> {
  if (typeof url !== 'string' || url === '' || /[\s<>"\\]/.test(url)) {
    throw new Error('unsubscribe url is not header-safe')
  }
  if (!url.startsWith('https://') && !LOOPBACK_HTTP.test(url)) {
    throw new Error('unsubscribe url must be https')
  }
  return {
    'List-Unsubscribe': `<${url}>`,
    'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
  }
}

type Action = { kind: 'ack' } | { kind: 'retry'; delaySeconds: number }
type Outcome = { entry: FinishEntry; action: Action }

function outcomeSent(row: ClaimedRow, providerId: string | null): Outcome {
  return { entry: { id: row.id, status: 'sent', provider_id: providerId }, action: { kind: 'ack' } }
}

function outcomeFailed(row: ClaimedRow, error: string): Outcome {
  return { entry: { id: row.id, status: 'failed', error }, action: { kind: 'ack' } }
}

function outcomeTransient(row: ClaimedRow, reason: string, nowMs: number, retryAfterSec?: number): Outcome {
  if (row.attempts >= MAX_ATTEMPTS) return outcomeFailed(row, `max_attempts:${reason}`)
  const delaySeconds = Math.min(
    typeof retryAfterSec === 'number' && retryAfterSec > 0 ? Math.ceil(retryAfterSec) : backoffSeconds(row.attempts),
    MAX_DELAY_SECONDS,
  )
  return {
    entry: {
      id: row.id,
      status: 'retrying',
      error: reason,
      next_attempt_at: new Date(nowMs + delaySeconds * 1000).toISOString(),
    },
    action: { kind: 'retry', delaySeconds },
  }
}

function isStale(row: ClaimedRow, nowMs: number): boolean {
  if (!row.first_attempt_at) return false
  const first = Date.parse(row.first_attempt_at)
  return Number.isFinite(first) && nowMs - first > STALE_AFTER_HOURS * 60 * 60 * 1000
}

async function processRow(row: ClaimedRow, deps: ConsumerDeps): Promise<Outcome> {
  const nowMs = deps.now()
  const tag = `id=${row.id} kind=${row.kind}`

  if (isStale(row, nowMs)) {
    deps.log(`${LOG_PREFIX} stale ${tag}`)
    return outcomeFailed(row, 'stale_over_23h')
  }
  if (!row.to_address) {
    deps.log(`${LOG_PREFIX} skipped no address ${tag}`)
    return { entry: { id: row.id, status: 'skipped', error: 'no_confirmed_address' }, action: { kind: 'ack' } }
  }

  let rendered: Rendered
  try {
    rendered = await deps.render(row)
  } catch {
    deps.log(`${LOG_PREFIX} render failed ${tag}`)
    return outcomeTransient(row, 'render_failed', nowMs)
  }

  let headers: Record<string, string> | undefined
  if (row.kind === 'digest') {
    // A digest without a working unsubscribe link is never sent (RFC 8058, Gmail/Yahoo bulk rules).
    if (!row.to_user) {
      deps.log(`${LOG_PREFIX} digest without user ${tag}`)
      return outcomeFailed(row, 'digest_without_user')
    }
    try {
      headers = unsubscribeHeaders(await deps.unsubscribeUrl(row.to_user))
    } catch {
      deps.log(`${LOG_PREFIX} unsubscribe url failed ${tag}`)
      return outcomeTransient(row, 'unsubscribe_url_failed', nowMs)
    }
  }

  let result
  try {
    result = await deps.mailer.send({
      to: row.to_address,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
      ...(row.reply_to ? { replyTo: row.reply_to } : {}),
      ...(headers ? { headers } : {}),
      idempotencyKey: row.idempotency_key,
    })
  } catch {
    deps.log(`${LOG_PREFIX} send threw ${tag}`)
    return outcomeTransient(row, 'send_threw', nowMs)
  }

  switch (result.kind) {
    case 'sent':
      deps.log(`${LOG_PREFIX} sent ${tag}`)
      return outcomeSent(row, result.providerId)
    case 'already_sent':
      deps.log(`${LOG_PREFIX} already sent ${tag}`)
      return outcomeSent(row, null)
    case 'retry':
      deps.log(`${LOG_PREFIX} retry ${result.reason} ${tag}`)
      return outcomeTransient(row, result.reason, nowMs, result.retryAfterSec)
    case 'permanent':
      deps.log(`${LOG_PREFIX} permanent ${result.status} ${tag}`)
      return outcomeFailed(row, `http_${result.status}`)
    default:
      deps.log(`${LOG_PREFIX} unknown result ${tag}`)
      return outcomeTransient(row, 'unknown_result', nowMs)
  }
}

function apply(message: MessageLike, action: Action): void {
  if (action.kind === 'retry') message.retry({ delaySeconds: action.delaySeconds })
  else message.ack()
}

/**
 * Process one queue batch. Throws only for infrastructure failure (claim or finish
 * could not reach Postgres): nothing is acked, so the queue redelivers the whole batch
 * and the lease, outbox status and Idempotency-Key keep the redelivery safe.
 */
export async function processBatch(batch: { messages: MessageLike[] }, deps: ConsumerDeps): Promise<void> {
  const byId = new Map<string, MessageLike[]>()
  for (const message of batch.messages) {
    const body = message.body
    const id =
      body && typeof body === 'object' && !Array.isArray(body) ? (body as { outboxId?: unknown }).outboxId : undefined
    if (typeof id !== 'string' || !UUID_RE.test(id)) {
      deps.log(`${LOG_PREFIX} bad message`)
      message.ack() // poison message: retrying cannot fix it
      continue
    }
    const key = id.toLowerCase()
    const list = byId.get(key)
    if (list) list.push(message)
    else byId.set(key, [message])
  }
  if (byId.size === 0) return

  const claimed = await deps.claimOutbox([...byId.keys()])
  const claimedIds = new Set<string>()

  const outcomes: Array<{ id: string; outcome: Outcome }> = []
  for (const row of claimed) {
    const id = row.id.toLowerCase()
    if (!byId.has(id) || claimedIds.has(id)) continue
    claimedIds.add(id)
    outcomes.push({ id, outcome: await processRow(row, deps) })
  }

  // Already sent, missing, or leased by another consumer: nothing to do, ack.
  for (const [id, messages] of byId) {
    if (claimedIds.has(id)) continue
    deps.log(`${LOG_PREFIX} not claimable id=${id}`)
    for (const message of messages) message.ack()
  }

  if (outcomes.length === 0) return
  // The DB write comes first; a throw here leaves every message unacked for redelivery.
  await deps.finishOutbox(outcomes.map((o) => o.outcome.entry))

  for (const { id, outcome } of outcomes) {
    const [first, ...duplicates] = byId.get(id) ?? []
    if (first) apply(first, outcome.action)
    for (const duplicate of duplicates) duplicate.ack()
  }
}
