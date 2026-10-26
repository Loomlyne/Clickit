// Support and newsletter mail decisions (05-28; MAIL-05, MAIL-06; D-31, D-32, D-39).
// Pure: no imports, so it runs under node --test and never pulls the email consumer
// or the templates into the Next server graph.
//
// The action layer (src/app/actions/contact.ts) saves first, then enqueues through
// enqueueEmail and maps what happened onto the visitor-facing status here.

/** What one enqueueEmail call ended as; 'error' = the call threw (RPC or validation). */
export type EnqueueStep = 'queued' | 'duplicate' | 'capped' | 'error'

export type SupportStatus = 'sent' | 'saved_email_failed'

export type NewsletterStatus =
  | 'pending_confirmation'
  | 'pending_recent'
  | 'already_subscribed'
  | 'saved_email_failed'

const HEADER_MAX = 200

/** Idempotency keys for one support message. enqueue_email appends ':<admin id>' to admin. */
export function supportKeys(messageId: string): { ack: string; admin: string } {
  return { ack: `support_ack:${messageId}`, admin: `support_admin:${messageId}` }
}

/** Key for the n-th confirm email of one subscriber (n = confirm_sent_at in epoch seconds). */
export function newsletterKey(subscriberId: string, n: number): string {
  if (!Number.isInteger(n) || n < 0) {
    throw new Error('newsletterKey: n must be a non-negative integer')
  }
  return `newsletter_confirm:${subscriberId}:${n}`
}

/**
 * User text that may reach a mail header (subject, Reply-To): every CR/LF run becomes
 * one space, then trimmed and capped at 200 characters (T-05-28-02).
 */
export function stripHeaderBreaks(value: string): string {
  return value.replace(/[\r\n]+/g, ' ').trim().slice(0, HEADER_MAX).trim()
}

/**
 * The message is already saved when this runs. A capped auto-reply (3 per address per
 * 24 h) or zero admins rows still reads as sent; only an enqueue that threw is reported
 * as saved_email_failed.
 */
export function supportOutcome(input: {
  ack: EnqueueStep
  admin: EnqueueStep
  adminIds?: readonly string[]
}): SupportStatus {
  if (input.ack === 'error' || input.admin === 'error') return 'saved_email_failed'
  return 'sent'
}

/** A subscriber counts as confirmed only with confirmed_at set and status active. */
export function isConfirmedSubscriber(
  row: { status: string; confirmed_at: string | null } | null | undefined
): boolean {
  return Boolean(row && row.status === 'active' && row.confirmed_at)
}

/**
 * Never says 'subscribed' before the click (D-32). A confirmed row is already
 * subscribed and gets no email; otherwise the confirm enqueue decides.
 */
export function newsletterOutcome(input: {
  existing: string | null
  confirmed: boolean
  enqueue?: EnqueueStep
}): NewsletterStatus {
  if (input.confirmed && input.existing === 'active') return 'already_subscribed'
  switch (input.enqueue) {
    case 'queued':
    case 'duplicate':
      return 'pending_confirmation'
    case 'capped':
      return 'pending_recent'
    default:
      return 'saved_email_failed'
  }
}
