// Ports for the queue consumer (D-28, RESEARCH Pattern 4, F9), shared by the Worker
// queue() handler (05-19) and the in-process dev queue (queue.ts). Pure: relative
// imports only, no server-only, no "@/" alias, no Next, fetch injected.
//
// claim and finish are PostgREST RPC calls with the service role (2 subrequests per
// batch, F9). The service key only ever travels in request headers to Supabase; it is
// never logged and never put in an error message. Errors carry the RPC name and the
// HTTP status, never a response body.

import { SITE_ORIGIN_DEFAULT } from '../../emails/brand.ts'
import { renderAppEmail } from '../../emails/render-app.ts'
import { signLinkToken, NEWSLETTER_CONFIRM_TTL_DAYS } from './links.ts'
import { createLocalMailer, createResendMailer, EMAIL_FROM_DEFAULT } from './transport.ts'
import type { ClaimedRow, ConsumerDeps, FinishEntry } from './consumer.ts'

/** The slice of the Worker env (or process env mapping) these ports read. */
export type EmailDepsEnv = {
  CLICKIT_RUNTIME?: string
  SUPABASE_URL?: string
  SUPABASE_SERVICE_ROLE_KEY?: string
  RESEND_API_KEY?: string
  EMAIL_LINK_SECRET?: string
  EMAIL_FROM?: string
  SITE_ORIGIN?: string
  MAILPIT_URL?: string
}

const DAY_SECONDS = 24 * 60 * 60

function cleanOrigin(origin: string): string {
  return origin.replace(/\/+$/, '')
}

function requireSecret(secret: string | undefined): string {
  if (typeof secret !== 'string' || secret.trim() === '') throw new Error('link secret missing')
  return secret
}

/** One-click unsubscribe URL (digest only, D-35). The token has no expiry (RFC 8058). */
export async function unsubscribeUrlFor(
  origin: string,
  userId: string,
  secret: string | undefined,
): Promise<string> {
  const token = await signLinkToken({
    kind: 'unsub_digest',
    id: userId,
    expSec: null,
    secret: requireSecret(secret),
  })
  return `${cleanOrigin(origin)}/api/email/unsubscribe?t=${token}`
}

/** Double-opt-in confirm URL (D-32), expiring NEWSLETTER_CONFIRM_TTL_DAYS days after `nowMs`. */
export async function newsletterConfirmUrlFor(
  origin: string,
  locale: 'en' | 'ar',
  subscriberId: string,
  secret: string | undefined,
  nowMs: number,
): Promise<string> {
  const token = await signLinkToken({
    kind: 'newsletter_confirm',
    id: subscriberId,
    expSec: Math.floor(nowMs / 1000) + NEWSLETTER_CONFIRM_TTL_DAYS * DAY_SECONDS,
    secret: requireSecret(secret),
  })
  return `${cleanOrigin(origin)}/${locale}/newsletter/confirm?t=${token}`
}

async function rpc(
  env: EmailDepsEnv,
  fetchImpl: typeof fetch,
  name: 'claim_outbox' | 'finish_outbox',
  body: unknown,
): Promise<unknown> {
  const base = env.SUPABASE_URL
  const key = env.SUPABASE_SERVICE_ROLE_KEY
  if (!base || !key) throw new Error(`${name}: supabase env missing`)
  const response = await fetchImpl(`${cleanOrigin(base)}/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
  if (!response.ok) throw new Error(`${name}: http ${response.status}`)
  return response.json()
}

export function buildEmailDeps(env: EmailDepsEnv, fetchImpl: typeof fetch = fetch): ConsumerDeps {
  const origin = cleanOrigin(env.SITE_ORIGIN ?? SITE_ORIGIN_DEFAULT)
  const from = env.EMAIL_FROM ?? EMAIL_FROM_DEFAULT
  const now = () => Date.now()

  const mailer =
    env.CLICKIT_RUNTIME === 'workers'
      ? createResendMailer({ apiKey: env.RESEND_API_KEY, from, fetch: fetchImpl })
      : createLocalMailer({
          runtime: env.CLICKIT_RUNTIME,
          from,
          fetch: fetchImpl,
          ...(env.MAILPIT_URL ? { mailpitUrl: env.MAILPIT_URL } : {}),
        })

  return {
    async claimOutbox(ids: string[]): Promise<ClaimedRow[]> {
      const rows = await rpc(env, fetchImpl, 'claim_outbox', { p_ids: ids })
      return Array.isArray(rows) ? (rows as ClaimedRow[]) : []
    },
    finishOutbox(entries: FinishEntry[]) {
      return rpc(env, fetchImpl, 'finish_outbox', { p_results: entries })
    },
    render(row) {
      const locale = row.locale === 'ar' ? 'ar' : 'en'
      return renderAppEmail(row, {
        siteOrigin: origin,
        links: {
          unsubscribe: (userId) => unsubscribeUrlFor(origin, userId, env.EMAIL_LINK_SECRET),
          newsletterConfirm: (subscriberId) =>
            newsletterConfirmUrlFor(origin, locale, subscriberId, env.EMAIL_LINK_SECRET, now()),
        },
      })
    },
    mailer,
    now,
    log: (line) => console.log(line),
    unsubscribeUrl: (userId) => unsubscribeUrlFor(origin, userId, env.EMAIL_LINK_SECRET),
  }
}
