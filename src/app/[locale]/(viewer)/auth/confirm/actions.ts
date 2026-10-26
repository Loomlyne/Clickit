'use server'

import { createClient } from '@/lib/supabase/server'
import { afterSignIn } from '@/server/auth/after-sign-in'
import {
  confirmOutcome,
  expiredRetryHref,
  parseConfirmParams,
  recoveryDestination,
  type ConfirmOutcome,
} from '@/server/auth/confirm-core'
import { destinationAfterSignIn, type AuthLocale } from '@/server/auth/sign-in-core'

/**
 * Email-link confirm action (05-23; AUTH-04; D-12, D-13; UI-SPEC 6.3). The only
 * place a link's token_hash is spent: the page's button posts here, so a mail
 * scanner's GET never burns it (T-05-23-01). type and token_hash are
 * whitelisted again here (the action is callable on its own), next is
 * re-sanitised. Logs carry the outcome and the Supabase error code only.
 */

export type ConfirmLinkState =
  | { status: 'idle' }
  | { status: 'navigate'; destination: string }
  | { status: 'pending_other' }
  | { status: 'email_changed' }
  | { status: 'expired'; retryHref: string; recovery: boolean }
  | { status: 'retry' }

function field(formData: FormData, name: string): string | undefined {
  const value = formData.get(name)
  return typeof value === 'string' ? value : undefined
}

function errorCodeOf(error: unknown): string {
  if (!error || typeof error !== 'object') return ''
  const { code, status } = error as { code?: unknown; status?: unknown }
  if (typeof code === 'string' && /^[a-z0-9_]{1,64}$/.test(code)) return code
  return typeof status === 'number' ? `status_${status}` : 'unknown'
}

function logConfirm(outcome: ConfirmOutcome | 'invalid', error?: unknown) {
  console.warn('[auth/confirm]', outcome, errorCodeOf(error))
}

export async function confirmLink(_prev: ConfirmLinkState, formData: FormData): Promise<ConfirmLinkState> {
  const locale: AuthLocale = field(formData, 'locale') === 'ar' ? 'ar' : 'en'
  const parsed = parseConfirmParams({
    token_hash: field(formData, 'token_hash'),
    type: field(formData, 'type'),
    next: field(formData, 'next'),
  })
  if (!parsed.ok) {
    logConfirm('invalid')
    return { status: 'expired', retryHref: expiredRetryHref(parsed.type, parsed.next), recovery: parsed.type === 'recovery' }
  }
  const { tokenHash, type, next } = parsed

  const supabase = await createClient()
  let result: Awaited<ReturnType<typeof supabase.auth.verifyOtp>>
  try {
    result = await supabase.auth.verifyOtp({ token_hash: tokenHash, type })
  } catch (thrown) {
    logConfirm('retry', thrown)
    return { status: 'retry' }
  }
  const { data, error } = result

  const outcome = confirmOutcome({ type, error, session: data.session })
  logConfirm(outcome, error)

  switch (outcome) {
    case 'retry':
      return { status: 'retry' }
    case 'expired':
      return { status: 'expired', retryHref: expiredRetryHref(type, next), recovery: type === 'recovery' }
    case 'pending_other':
      return { status: 'pending_other' }
    case 'email_changed':
      return { status: 'email_changed' }
    case 'recovery':
    case 'signed_in': {
      let destination: string
      try {
        // A session implies a user; guard anyway so a missing one cannot throw past the sign-in.
        destination = data.user
          ? await afterSignIn(data.user, { locale, method: 'link', next, supabase })
          : destinationAfterSignIn({ needsOnboarding: false, isAdmin: false, next })
      } catch {
        console.error('[auth/confirm] after sign-in failed, default destination used')
        destination = destinationAfterSignIn({ needsOnboarding: false, isAdmin: false, next })
      }
      // Recovery: the visitor is signed in on this device; the next step is the
      // new password, whatever afterSignIn would have chosen (D-13).
      return { status: 'navigate', destination: outcome === 'recovery' ? recoveryDestination(next) : destination }
    }
  }
}
