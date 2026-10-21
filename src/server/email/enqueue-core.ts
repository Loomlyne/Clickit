// Producer core of the email pipeline (D-28, D-29; Phase 6 contract item 6). Pure:
// relative imports only, no server-only, no "@/" alias, no Next, so it runs under
// node --test. The wrapper outbox.ts injects the Supabase RPC and the queue.
//
// Order is the contract: the outbox row is written through enqueue_email first (that
// is the record), and only then does a { outboxId } doorbell go to the queue. A queue
// failure never fails the caller; the row stays pending and the 15-minute sweep
// re-enqueues it. An RPC failure does throw, so the caller decides (support keeps the
// saved message and reports saved_email_failed).
//
// APP_EMAIL_KINDS comes from the light model module, never from the renderer module,
// so enqueue-only code never bundles the pre-rendered templates JSON (05-11 revision 5).
//
// Logs carry the kind and the idempotency key only (never an address or payload).

import { APP_EMAIL_KINDS } from '../../emails/app/model.ts'

export type EnqueueKind = (typeof APP_EMAIL_KINDS)[number]
export type EnqueueLocale = 'en' | 'ar'

export type EnqueueTarget =
  | { userId: string; locale?: EnqueueLocale }
  | { adminAll: true; locale?: EnqueueLocale }
  | { email: string; locale?: EnqueueLocale }

export type EnqueueInput = {
  kind: EnqueueKind
  idempotencyKey: string
  to: EnqueueTarget
  data: Record<string, unknown>
  replyTo?: string
}

export type EnqueueOutcome = 'queued' | 'duplicate' | 'capped'
export type EnqueueResult = { outcome: EnqueueOutcome; ids: string[] }

/** Arguments of public.enqueue_email (05-13). Undefined keys are omitted from the call. */
export type EnqueueRpcArgs = {
  p_kind: string
  p_key: string
  p_to_user?: string
  p_to_email?: string
  p_admin_all: boolean
  p_payload: Record<string, unknown>
  p_locale: EnqueueLocale
  p_reply_to?: string
}

export type EnqueuePorts = {
  rpc(args: EnqueueRpcArgs): Promise<{ id: string | null; outcome: string }[]>
  queue: { sendBatch(messages: { body: { outboxId: string } }[]): Promise<void> }
  log: { warn(message: string): void; error(message: string): void }
}

const LOG_PREFIX = '[email/outbox]'
const KEY_MAX = 200
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const EMAIL_RE = /^[^\s@<>,;"]+@[^\s@<>,;"]+\.[^\s@<>,;"]+$/

function stripCrlf(value: string): string {
  return value.replace(/[\r\n]/g, '')
}

function cleanEmail(value: unknown, field: string): string {
  if (typeof value !== 'string') throw new Error(`enqueueEmail: ${field} must be a string`)
  const cleaned = stripCrlf(value).trim()
  if (cleaned.length > 254 || !EMAIL_RE.test(cleaned)) {
    throw new Error(`enqueueEmail: ${field} is not a simple email address`)
  }
  return cleaned
}

function validate(input: EnqueueInput): EnqueueRpcArgs {
  const key = input.idempotencyKey
  if (typeof key !== 'string' || key.length < 1 || key.length > KEY_MAX) {
    throw new Error(`enqueueEmail: idempotencyKey must be 1-${KEY_MAX} characters`)
  }
  if (!(APP_EMAIL_KINDS as readonly string[]).includes(input.kind)) {
    throw new Error('enqueueEmail: unknown kind')
  }
  const data = input.data
  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    throw new Error('enqueueEmail: data must be an object')
  }
  const to = (input.to ?? {}) as Record<string, unknown>
  const targets = (['userId', 'adminAll', 'email'] as const).filter((k) => to[k] !== undefined)
  if (targets.length !== 1) throw new Error('enqueueEmail: exactly one target is required')

  const locale = to.locale === undefined ? 'en' : to.locale
  if (locale !== 'en' && locale !== 'ar') throw new Error('enqueueEmail: locale must be en or ar')

  const args: EnqueueRpcArgs = {
    p_kind: input.kind,
    p_key: key,
    p_admin_all: false,
    p_payload: data,
    p_locale: locale,
  }
  if (targets[0] === 'userId') {
    if (typeof to.userId !== 'string' || !UUID_RE.test(to.userId)) {
      throw new Error('enqueueEmail: userId must be a uuid')
    }
    args.p_to_user = to.userId
  } else if (targets[0] === 'adminAll') {
    if (to.adminAll !== true) throw new Error('enqueueEmail: adminAll must be true')
    args.p_admin_all = true
  } else {
    args.p_to_email = cleanEmail(to.email, 'email')
  }
  if (input.replyTo !== undefined) args.p_reply_to = cleanEmail(input.replyTo, 'replyTo')
  return args
}

function summarise(rows: { outcome: string }[]): EnqueueOutcome {
  if (rows.some((r) => r.outcome === 'queued')) return 'queued'
  if (rows.some((r) => r.outcome === 'duplicate')) return 'duplicate'
  if (rows.some((r) => r.outcome === 'capped')) return 'capped'
  return 'queued'
}

export async function enqueueEmailCore(input: EnqueueInput, ports: EnqueuePorts): Promise<EnqueueResult> {
  const args = validate(input)
  const rows = await ports.rpc(args)

  if (rows.length === 0) {
    // adminAll while the admins table is empty (between the 05-36 deploy and the admins
    // inserts): nothing to send, the caller is not failed.
    ports.log.warn(`${LOG_PREFIX} no_recipients kind=${input.kind} key=${input.idempotencyKey}`)
    return { outcome: 'queued', ids: [] }
  }

  const outcome = summarise(rows)
  const ids = rows
    .filter((r) => r.outcome === 'queued' && typeof r.id === 'string')
    .map((r) => r.id as string)
  if (ids.length === 0) return { outcome, ids: [] }

  try {
    await ports.queue.sendBatch(ids.map((outboxId) => ({ body: { outboxId } })))
  } catch {
    // The row is pending in Postgres; the sweep re-enqueues it after 15 minutes (D-29).
    ports.log.error(`${LOG_PREFIX} queue send failed, sweep will retry kind=${input.kind}`)
  }
  return { outcome: 'queued', ids }
}
