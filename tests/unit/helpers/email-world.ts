/* Shared fake world for the email pipeline (plan 05-08). Test-only. */
import type { MailMessage, Mailer, SendResult } from '../../../src/server/email/transport.ts'

export const START_MS = Date.UTC(2026, 9, 21, 12, 0, 0)
export const LEASE_MS = 5 * 60 * 1000
export const KEY_WINDOW_MS = 24 * 60 * 60 * 1000
export const UNSUB_BASE = 'https://www.clickitstory.ae/api/email/unsubscribe'

export type WorldStatus = 'pending' | 'sending' | 'retrying' | 'sent' | 'failed' | 'skipped'

/** One stored outbox row (the 05-13 email_outbox shape, with to_address already resolved). */
export type WorldRow = {
  id: string
  kind: string
  idempotency_key: string
  to_user: string | null
  to_address: string | null
  reply_to: string | null
  locale: 'en' | 'ar'
  payload: Record<string, unknown>
  status: WorldStatus
  attempts: number
  first_attempt_at: string | null
  lease_until: number | null
  next_attempt_at: string | null
  provider_id: string | null
  last_error: string | null
}

/** What claim_outbox returns (contract with 05-13). */
export type WorldClaimed = Pick<
  WorldRow,
  | 'id'
  | 'kind'
  | 'idempotency_key'
  | 'to_address'
  | 'reply_to'
  | 'locale'
  | 'payload'
  | 'attempts'
  | 'first_attempt_at'
  | 'to_user'
>

export type WorldFinishEntry = {
  id: string
  status: 'sent' | 'retrying' | 'failed' | 'skipped'
  provider_id?: string | null
  error?: string | null
  next_attempt_at?: string | null
}

/** One scripted provider failure; consumed one per send call. */
export type FailStep = 429 | 500 | '409-concurrent' | 400 | 'throw' | { status: 429; retryAfter: number }

export type WorldOpts = {
  failNext?: FailStep[]
  /** Resend key missing: every send returns retry not_configured. */
  notConfigured?: boolean
  /** claimOutbox throws this many times before working. */
  claimFails?: number
  /** finishOutbox throws this many times (before applying anything) before working. */
  finishFails?: number
  /** render throws for these kinds. */
  renderThrowsFor?: string[]
}

export type WorldMessage = {
  body: unknown
  attempts: number
  acks: number
  retries: Array<{ delaySeconds?: number } | undefined>
  ack(): void
  retry(options?: { delaySeconds?: number }): void
}

let counter = 0

function uuid(): string {
  counter += 1
  return `00000000-0000-4000-8000-${String(counter).padStart(12, '0')}`
}

function payloadHash(message: MailMessage): string {
  return JSON.stringify([message.to, message.subject, message.html, message.text, message.headers ?? null])
}

export function emailWorld(opts: WorldOpts = {}) {
  let nowMs = START_MS
  const outbox = new Map<string, WorldRow>()
  const failNext: FailStep[] = [...(opts.failNext ?? [])]
  let claimFails = opts.claimFails ?? 0
  let finishFails = opts.finishFails ?? 0

  const claimCalls: string[][] = []
  const finishCalls: WorldFinishEntry[][] = []
  const sentMessages: MailMessage[] = []
  const logs: string[] = []
  const renderCalls: string[] = []
  const keys = new Map<string, { hash: string; providerId: string; at: number }>()
  let providerCounter = 0

  const world = {
    outbox,
    logs,
    claimCalls,
    finishCalls,
    sentMessages,
    renderCalls,
    opts,
    get sends() {
      return sentMessages.length
    },
    get distinctProviderSends() {
      return keys.size
    },
    now: () => nowMs,
    advance(ms: number) {
      nowMs += ms
    },
    setNow(ms: number) {
      nowMs = ms
    },
    isoAgo(ms: number) {
      return new Date(nowMs - ms).toISOString()
    },
    failNext,

    addRow(partial: Partial<WorldRow> = {}): WorldRow {
      const id = partial.id ?? uuid()
      const row: WorldRow = {
        id,
        kind: 'welcome',
        idempotency_key: `key-${id}`,
        to_user: uuid(),
        to_address: 'viewer@example.test',
        reply_to: null,
        locale: 'en',
        payload: {},
        status: 'pending',
        attempts: 0,
        first_attempt_at: null,
        lease_until: null,
        next_attempt_at: null,
        provider_id: null,
        last_error: null,
        ...partial,
      }
      outbox.set(id, row)
      return row
    },

    /** Mimics claim_outbox (05-13): pending/retrying with a free lease, or sending with an expired lease. */
    async claimOutbox(ids: string[]): Promise<WorldClaimed[]> {
      claimCalls.push([...ids])
      if (claimFails > 0) {
        claimFails -= 1
        throw new Error('claim_outbox failed')
      }
      const out: WorldClaimed[] = []
      for (const id of ids) {
        const row = outbox.get(id)
        if (!row) continue
        const leaseFree = row.lease_until === null || row.lease_until <= nowMs
        const claimable =
          ((row.status === 'pending' || row.status === 'retrying') && leaseFree) ||
          (row.status === 'sending' && leaseFree)
        if (!claimable) continue
        row.status = 'sending'
        row.attempts += 1
        row.first_attempt_at ??= new Date(nowMs).toISOString()
        row.lease_until = nowMs + LEASE_MS
        out.push({
          id: row.id,
          kind: row.kind,
          idempotency_key: row.idempotency_key,
          to_address: row.to_address,
          reply_to: row.reply_to,
          locale: row.locale,
          payload: row.payload,
          attempts: row.attempts,
          first_attempt_at: row.first_attempt_at,
          to_user: row.to_user,
        })
      }
      return out
    },

    /** Mimics finish_outbox (05-13): only rows currently 'sending' are updated. */
    async finishOutbox(results: WorldFinishEntry[]): Promise<number> {
      finishCalls.push(results.map((r) => ({ ...r })))
      if (finishFails > 0) {
        finishFails -= 1
        throw new Error('finish_outbox failed')
      }
      let updated = 0
      for (const entry of results) {
        const row = outbox.get(entry.id)
        if (!row || row.status !== 'sending') continue
        row.status = entry.status
        row.lease_until = null
        row.provider_id = entry.provider_id ?? row.provider_id
        row.last_error = entry.error ? entry.error.slice(0, 200) : null
        row.next_attempt_at = entry.next_attempt_at ?? null
        updated += 1
      }
      return updated
    },

    /** Fake Resend: 24 h Idempotency-Key window, 409 on a reused key with a different payload. */
    mailer: {
      async send(message: MailMessage): Promise<SendResult> {
        sentMessages.push(message)
        if (opts.notConfigured) return { kind: 'retry', reason: 'not_configured' }
        const step = failNext.shift()
        if (step === 'throw') throw new Error('network down')
        if (step === 429) return { kind: 'retry', reason: 'rate_limited' }
        if (typeof step === 'object') {
          return { kind: 'retry', reason: 'rate_limited', retryAfterSec: step.retryAfter }
        }
        if (step === 500) return { kind: 'retry', reason: 'server_error' }
        if (step === '409-concurrent') return { kind: 'retry', reason: 'concurrent' }
        if (step === 400) return { kind: 'permanent', status: 400 }

        const hash = payloadHash(message)
        const known = keys.get(message.idempotencyKey)
        if (known && nowMs - known.at < KEY_WINDOW_MS) {
          return known.hash === hash ? { kind: 'sent', providerId: known.providerId } : { kind: 'already_sent' }
        }
        providerCounter += 1
        const providerId = `re_${providerCounter}`
        keys.set(message.idempotencyKey, { hash, providerId, at: nowMs })
        return { kind: 'sent', providerId }
      },
    } satisfies Mailer,

    render(row: { kind: string; locale: string }) {
      renderCalls.push(row.kind)
      if (opts.renderThrowsFor?.includes(row.kind)) throw new Error('render failed')
      return {
        subject: `Subject of ${row.kind} (${row.locale})`,
        html: `<p>HTML body of ${row.kind} (${row.locale})</p>`,
        text: `Text body of ${row.kind} (${row.locale})`,
      }
    },

    async unsubscribeUrl(userId: string): Promise<string> {
      return `${UNSUB_BASE}?u=${userId}&k=digest&t=testtoken`
    },

    log(line: string) {
      logs.push(line)
    },

    message(outboxId: unknown, attempts = 1): WorldMessage {
      const message: WorldMessage = {
        body: typeof outboxId === 'string' ? { outboxId } : outboxId,
        attempts,
        acks: 0,
        retries: [],
        ack() {
          message.acks += 1
        },
        retry(options) {
          message.retries.push(options)
        },
      }
      return message
    },

    /** Ports object ready for processBatch; override any port per test. */
    deps<T extends Record<string, unknown> = Record<string, never>>(override?: T) {
      return {
        claimOutbox: world.claimOutbox,
        finishOutbox: world.finishOutbox,
        render: world.render,
        mailer: world.mailer,
        now: world.now,
        log: world.log,
        unsubscribeUrl: world.unsubscribeUrl,
        ...(override ?? ({} as T)),
      }
    },
  }
  return world
}
