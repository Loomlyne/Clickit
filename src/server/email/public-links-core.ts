// Login-free email endpoints (D-35 one-click unsubscribe, D-32 newsletter confirm).
// Pure decisions with an injected store: relative imports only, no server-only, no
// Next, so node --test can run it and workerd can host it.
//
// Rules this module enforces:
// - A token is verified (kind-separated HMAC, expiry on confirm) BEFORE any store call.
// - Nothing here logs or returns an address or a token. The store only sees ids.
// - preview* functions only read (they back the GET pages); only unsubscribeRequest
//   and newsletterConfirmRequest write.

import { verifyLinkToken } from './links.ts'

type Secret = string | null | undefined

export type UnsubscribeStore = {
  /** Set profiles.notify_new_episodes for one viewer. Idempotent. */
  setNotify(userId: string, value: boolean): Promise<void>
  /** Current flag, or null when the viewer row does not exist. */
  getNotify(userId: string): Promise<boolean | null>
}

export type NewsletterStore = {
  /** Set confirmed_at and status 'active' when confirmed_at is still null. */
  confirm(subscriberId: string): Promise<'confirmed' | 'already'>
  /** True when the subscriber is already confirmed. */
  isConfirmed(subscriberId: string): Promise<boolean>
}

export type UnsubscribeResult =
  | { ok: true; userId: string }
  | { ok: false; reason: 'invalid' | 'unavailable' | 'error' }

export type NewsletterConfirmResult =
  | 'confirmed'
  | 'already'
  | 'expired'
  | 'invalid'
  | 'unavailable'
  | 'error'

export type UnsubscribePreview = 'ready' | 'done' | 'invalid' | 'unavailable'
export type NewsletterPreview = 'ready' | 'already' | 'expired' | 'invalid' | 'unavailable'

export async function unsubscribeRequest(input: {
  token: string
  secret: Secret
  now: number
  store: UnsubscribeStore
}): Promise<UnsubscribeResult> {
  if (typeof input.secret !== 'string' || input.secret.trim() === '') {
    return { ok: false, reason: 'unavailable' }
  }
  const v = await verifyLinkToken(input.token, 'unsub_digest', input.secret, input.now)
  if (!v.ok) return { ok: false, reason: v.reason === 'unavailable' ? 'unavailable' : 'invalid' }
  try {
    await input.store.setNotify(v.id, false)
  } catch {
    return { ok: false, reason: 'error' }
  }
  return { ok: true, userId: v.id }
}

export async function previewUnsubscribe(input: {
  token: string
  secret: Secret
  now: number
  store: UnsubscribeStore
}): Promise<UnsubscribePreview> {
  if (typeof input.secret !== 'string' || input.secret.trim() === '') return 'unavailable'
  const v = await verifyLinkToken(input.token, 'unsub_digest', input.secret, input.now)
  if (!v.ok) return v.reason === 'unavailable' ? 'unavailable' : 'invalid'
  try {
    return (await input.store.getNotify(v.id)) === false ? 'done' : 'ready'
  } catch {
    return 'ready'
  }
}

export async function newsletterConfirmRequest(input: {
  token: string
  secret: Secret
  now: number
  store: NewsletterStore
}): Promise<NewsletterConfirmResult> {
  if (typeof input.secret !== 'string' || input.secret.trim() === '') return 'unavailable'
  const v = await verifyLinkToken(input.token, 'newsletter_confirm', input.secret, input.now)
  if (!v.ok) return v.reason
  try {
    return await input.store.confirm(v.id)
  } catch {
    return 'error'
  }
}

export async function previewNewsletterConfirm(input: {
  token: string
  secret: Secret
  now: number
  store: NewsletterStore
}): Promise<NewsletterPreview> {
  if (typeof input.secret !== 'string' || input.secret.trim() === '') return 'unavailable'
  const v = await verifyLinkToken(input.token, 'newsletter_confirm', input.secret, input.now)
  if (!v.ok) return v.reason
  try {
    return (await input.store.isConfirmed(v.id)) ? 'already' : 'ready'
  } catch {
    return 'ready'
  }
}
