// Mailer port with a Resend implementation (plain fetch, no SDK) and a local
// Mailpit implementation (D-28, RESEARCH F8). Pure: no server-only, no "@/"
// imports, fetch is injected so tests need no network.
//
// Results carry only a classification (kind, providerId, status, retryAfterSec,
// reason). They never contain the message, the recipient, the API key or a
// provider response body (V8): callers store the reason string, nothing else.

export const EMAIL_FROM_DEFAULT = 'Clickit Story <no-reply@clickitstory.ae>'

const RESEND_ENDPOINT = 'https://api.resend.com/emails'
const MAILPIT_DEFAULT_URL = 'http://127.0.0.1:55324'

export type MailMessage = {
  to: string
  subject: string
  html: string
  text: string
  replyTo?: string
  headers?: Record<string, string>
  idempotencyKey: string
}

export type SendResult =
  | { kind: 'sent'; providerId: string }
  | { kind: 'already_sent' }
  | { kind: 'retry'; reason: string; retryAfterSec?: number }
  | { kind: 'permanent'; status: number }

export interface Mailer {
  send(message: MailMessage): Promise<SendResult>
}

type FetchLike = typeof fetch

function errorName(body: unknown): string | null {
  if (body && typeof body === 'object' && 'name' in body) {
    const name = (body as { name?: unknown }).name
    return typeof name === 'string' ? name : null
  }
  return null
}

function providerId(body: unknown): string | null {
  if (body && typeof body === 'object' && 'id' in body) {
    const id = (body as { id?: unknown }).id
    return typeof id === 'string' && id !== '' ? id : null
  }
  return null
}

function parseRetryAfter(header: string | null | undefined): number | undefined {
  if (typeof header !== 'string' || !/^\d{1,6}$/.test(header.trim())) return undefined
  const seconds = Number(header.trim())
  return seconds > 0 ? seconds : undefined
}

// Resend status classes (RESEARCH "Resend send with idempotency"):
// 2xx sent; 429 and 5xx retry; 409 invalid_idempotent_request means the same key
// was already used with a different payload or already sent -> treated as sent;
// 409 concurrent_idempotent_requests retry; any other 4xx is permanent.
export function classifyResendResponse(
  status: number,
  bodyJson: unknown,
  retryAfterHeader: string | null | undefined,
): SendResult {
  if (status >= 200 && status < 300) {
    const id = providerId(bodyJson)
    return id ? { kind: 'sent', providerId: id } : { kind: 'retry', reason: 'no_provider_id' }
  }
  if (status === 409) {
    const name = errorName(bodyJson)
    if (name === 'invalid_idempotent_request') return { kind: 'already_sent' }
    if (name === 'concurrent_idempotent_requests') return { kind: 'retry', reason: 'concurrent' }
    return { kind: 'permanent', status }
  }
  if (status === 429) {
    const retryAfterSec = parseRetryAfter(retryAfterHeader)
    return retryAfterSec === undefined
      ? { kind: 'retry', reason: 'rate_limited' }
      : { kind: 'retry', reason: 'rate_limited', retryAfterSec }
  }
  if (status >= 500) return { kind: 'retry', reason: 'server_error' }
  return { kind: 'permanent', status }
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json()
  } catch {
    return null
  }
}

export function createResendMailer(options: {
  apiKey: string | undefined
  from: string
  fetch?: FetchLike
}): Mailer {
  const apiKey = typeof options.apiKey === 'string' ? options.apiKey.trim() : ''
  const doFetch = options.fetch ?? fetch
  return {
    async send(message) {
      // Owner step (Resend key) not done yet: retry later, never a permanent failure.
      if (apiKey === '') return { kind: 'retry', reason: 'not_configured' }
      const body: Record<string, unknown> = {
        from: options.from,
        to: [message.to],
        subject: message.subject,
        html: message.html,
        text: message.text,
      }
      if (message.replyTo) body.reply_to = message.replyTo
      if (message.headers && Object.keys(message.headers).length > 0) body.headers = message.headers
      let response: Response
      try {
        response = await doFetch(RESEND_ENDPOINT, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
            'Idempotency-Key': message.idempotencyKey,
          },
          body: JSON.stringify(body),
        })
      } catch {
        return { kind: 'retry', reason: 'network' }
      }
      const json = await readJson(response)
      return classifyResendResponse(response.status, json, response.headers.get('retry-after'))
    },
  }
}

function parseFrom(from: string): { Email: string; Name?: string } {
  const match = /^\s*(.*?)\s*<([^<>]+)>\s*$/.exec(from)
  if (!match) return { Email: from.trim() }
  const name = match[1].replace(/^"|"$/g, '')
  return name ? { Email: match[2].trim(), Name: name } : { Email: match[2].trim() }
}

export function createLocalMailer(options: {
  runtime: string | undefined
  mailpitUrl?: string
  from?: string
  fetch?: FetchLike
}): Mailer {
  // Local mail must never be wired into the deployed Worker (T-05-04-04).
  if (options.runtime === 'workers') throw new Error('local mailer refused on workers')
  const base = (options.mailpitUrl ?? MAILPIT_DEFAULT_URL).replace(/\/+$/, '')
  const from = parseFrom(options.from ?? EMAIL_FROM_DEFAULT)
  const doFetch = options.fetch ?? fetch
  return {
    async send(message) {
      const body: Record<string, unknown> = {
        From: from,
        To: [{ Email: message.to }],
        Subject: message.subject,
        HTML: message.html,
        Text: message.text,
      }
      if (message.replyTo) body.ReplyTo = [{ Email: message.replyTo }]
      if (message.headers && Object.keys(message.headers).length > 0) body.Headers = message.headers
      try {
        const response = await doFetch(`${base}/api/v1/send`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
        if (!response.ok) return { kind: 'retry', reason: 'local_unavailable' }
        const json = (await readJson(response)) as { ID?: unknown } | null
        const id = json && typeof json.ID === 'string' && json.ID !== '' ? json.ID : 'local'
        return { kind: 'sent', providerId: id }
      } catch {
        return { kind: 'retry', reason: 'local_unavailable' }
      }
    },
  }
}
