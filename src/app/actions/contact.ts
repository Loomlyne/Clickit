'use server'

import { revalidatePath } from 'next/cache'
import { headers } from 'next/headers'

import {
  buildNewsletterInterests,
  newsletterSignupSchema,
  normalizeEmail,
  supportMessageSchema,
  type NewsletterSignupInput,
  type NewsletterSignupResult,
  type SupportMessageInput,
  type SupportSubmitResult,
} from '@/lib/contact'
import type { Json } from '@/lib/database.types'
import { createAdminClient } from '@/lib/supabase/admin'
import { clientIpFrom } from '@/server/client-ip'
import {
  isConfirmedSubscriber,
  newsletterKey,
  newsletterOutcome,
  stripHeaderBreaks,
  supportKeys,
  supportOutcome,
  type EnqueueStep,
} from '@/server/email/contact-core'
import {
  enqueueEmail,
  type EnqueueInput,
  type EnqueueResult,
} from '@/server/email/outbox'
import { guardPublicForm, readCaptchaToken, type GuardError } from '@/server/form-guard'
import type { RateLimitStore } from '@/server/rate-limit-policy'
import { supabaseRateLimitStore } from '@/server/rate-limit-store'
import { verifyTurnstileToken } from '@/server/turnstile'

function validationError(fieldErrors: Record<string, string[] | undefined>) {
  return {
    ok: false as const,
    code: 'validation' as const,
    fieldErrors,
  }
}

// Abuse throttle store for public unauthenticated actions: the rate_limits
// ledger (service_role only), shared helper in src/server/rate-limit-store.ts.
// The client IP is folded into the key as `<key>:<ip>`; errors throw, so the
// limiter (decideRateLimit) fails closed.
function rateLimitStore(): RateLimitStore {
  return supabaseRateLimitStore(createAdminClient())
}

// Messages are plain strings in the action result (same shape as before). The
// captcha line is the signed copy from mockups/DECISIONS.md. Localised keys
// are a 02-13 / owner item: no Arabic wording is signed yet.
const GUARD_MESSAGES: Record<GuardError, string> = {
  captcha: 'Security check failed. Please try again.',
  rate_limited: 'Too many requests. Please try again in a little while.',
  unavailable: 'This service is temporarily unavailable. Please try again later.',
}

function guardRefusal(context: string, error: GuardError, reason?: string) {
  console.warn('[contact]', context, 'refused', error, reason ?? '')
  return {
    ok: false as const,
    code: 'unknown' as const,
    message: GUARD_MESSAGES[error],
  }
}

// Turnstile siteverify (with remoteip) first, then the fail-closed limiter on
// the Cloudflare-supplied client IP. Runs after zod validation and before any
// insert, so a refused request writes nothing (T-02-41, T-02-42, T-02-43).
async function guardAction(
  context: 'support' | 'newsletter',
  turnstileToken: unknown,
  limit: number
) {
  let ip: string | null = null
  try {
    ip = clientIpFrom(await headers(), {
      allowLocalOverride: process.env.LOCAL_DEV === '1',
    })
  } catch {
    ip = null
  }
  let store: RateLimitStore
  try {
    store = rateLimitStore()
  } catch {
    return guardRefusal(context, 'unavailable', 'store-init')
  }
  const result = await guardPublicForm({
    token: readCaptchaToken(turnstileToken),
    secret: process.env.TURNSTILE_SECRET_KEY,
    ip,
    verify: (args) => verifyTurnstileToken({ ...args, fetchImpl: fetch }),
    rateLimit: { key: context, limit, windowMs: 3_600_000, store },
  })
  return result.ok ? null : guardRefusal(context, result.error, result.reason)
}

// One enqueue through the outbox (D-28). A throw (RPC down, validation) becomes 'error'
// so the saved row is never lost; the log carries the kind only, never an address.
async function enqueueStep(
  kind: EnqueueInput['kind'],
  send: () => Promise<EnqueueResult>
): Promise<EnqueueStep> {
  try {
    return (await send()).outcome
  } catch {
    // No error text: an RPC message could quote the address.
    console.error('[contact] enqueue failed kind=' + kind)
    return 'error'
  }
}

// turnstileToken: the widget token (string) or a FormData carrying the
// cf-turnstile-response field. Plan 02-13 wires the client.
export async function submitSupportMessage(
  input: SupportMessageInput,
  turnstileToken?: string | FormData
): Promise<SupportSubmitResult> {
  const parsed = supportMessageSchema.safeParse(input)

  if (!parsed.success) {
    return validationError(parsed.error.flatten().fieldErrors)
  }

  const refused = await guardAction('support', turnstileToken, 5)
  if (refused) return refused

  try {
    const admin = createAdminClient()
    const payload = parsed.data
    const locale = payload.locale ?? 'en'

    // Save first (D-31): a delivery problem below never loses the message.
    const { data: inserted, error: insertError } = await admin
      .from('support_messages')
      .insert({
        name: payload.name,
        email: payload.email,
        phone: payload.phone || null,
        subject: payload.subject,
        message: payload.message,
      })
      .select('id')
      .single()

    if (insertError || !inserted) {
      throw new Error(insertError?.message || 'Failed to save support message')
    }

    const keys = supportKeys(inserted.id)
    // Static auto-reply to the sender in the page language (D-39: never echoes the
    // visitor's text; capped at 3 per address per 24 h inside enqueue_email).
    const ack = await enqueueStep('support_ack', () =>
      enqueueEmail({
        kind: 'support_ack',
        idempotencyKey: keys.ack,
        to: { email: payload.email, locale },
        data: {},
      })
    )
    // One admin copy per admins row (the RPC appends ':<admin id>'), Reply-To = sender.
    const adminCopy = await enqueueStep('support_admin', () =>
      enqueueEmail({
        kind: 'support_admin',
        idempotencyKey: keys.admin,
        to: { adminAll: true },
        data: {
          message_id: inserted.id,
          name: stripHeaderBreaks(payload.name),
          email: stripHeaderBreaks(payload.email),
          subject: stripHeaderBreaks(payload.subject),
          message: payload.message,
        },
        replyTo: stripHeaderBreaks(payload.email),
      })
    )

    if (adminCopy === 'error') {
      // No outbox row exists, so finish_outbox will never mirror a status here.
      const { error: markError } = await admin
        .from('support_messages')
        .update({
          notification_status: 'failed',
          notification_error: 'enqueue failed',
        })
        .eq('id', inserted.id)
      if (markError) console.error('[contact] support mark failed')
    }

    revalidatePath('/admin/inbox')
    return { ok: true, status: supportOutcome({ ack, admin: adminCopy }) }
  } catch (error) {
    return {
      ok: false,
      code: 'unknown',
      message:
        error instanceof Error
          ? error.message
          : 'Failed to submit support message',
    }
  }
}

export async function subscribeToNewsletter(
  input: NewsletterSignupInput,
  turnstileToken?: string | FormData
): Promise<NewsletterSignupResult> {
  const parsed = newsletterSignupSchema.safeParse(input)

  if (!parsed.success) {
    return validationError(parsed.error.flatten().fieldErrors)
  }

  const refused = await guardAction('newsletter', turnstileToken, 10)
  if (refused) return refused

  try {
    const admin = createAdminClient()
    const payload = parsed.data
    const locale = payload.locale ?? 'en'
    const normalizedEmail = normalizeEmail(payload.email)
    const { data: existing, error: existingError } = await admin
      .from('newsletter_subscribers')
      .select('id, interests, status, confirmed_at')
      .eq('normalized_email', normalizedEmail)
      .maybeSingle()

    if (existingError) {
      throw new Error(existingError.message)
    }

    // A confirmed subscriber stays active and gets no email (D-32).
    if (isConfirmedSubscriber(existing)) {
      return {
        ok: true,
        status: newsletterOutcome({
          existing: existing?.status ?? null,
          confirmed: true,
        }),
      }
    }

    const nextInterests = buildNewsletterInterests(existing?.interests, {
      slug: payload.interestSlug,
      title: payload.interestTitle,
    })

    const row = {
      email: payload.email.trim(),
      normalized_email: normalizedEmail,
      source: payload.source,
      status: 'pending',
      locale,
      interests: nextInterests as Json,
      // A row that is not active but still carries an old confirmed_at (paused or
      // unsubscribed) must confirm again: the confirm page only writes where
      // confirmed_at is null. New and pending rows keep confirmed_at null.
      ...(existing?.confirmed_at ? { confirmed_at: null } : {}),
    }

    const { data: saved, error: upsertError } = await admin
      .from('newsletter_subscribers')
      .upsert(row, { onConflict: 'normalized_email' })
      .select('id')
      .single()

    if (upsertError || !saved) {
      throw new Error(
        upsertError?.message || 'Failed to save newsletter subscriber'
      )
    }

    // n = epoch seconds of this send, so every sign-up gets its own key; the RPC caps
    // confirm emails at 1 per address per 10 minutes (D-39).
    const sentAt = Math.floor(Date.now() / 1000)
    const step = await enqueueStep('newsletter_confirm', () =>
      enqueueEmail({
        kind: 'newsletter_confirm',
        idempotencyKey: newsletterKey(saved.id, sentAt),
        to: { email: payload.email.trim(), locale },
        data: { subscriber_id: saved.id },
      })
    )

    if (step === 'queued') {
      const { error: sentError } = await admin
        .from('newsletter_subscribers')
        .update({ confirm_sent_at: new Date(sentAt * 1000).toISOString() })
        .eq('id', saved.id)
      if (sentError) console.error('[contact] confirm_sent_at update failed')
    }

    revalidatePath('/admin/inbox')
    return {
      ok: true,
      status: newsletterOutcome({
        existing: existing?.status ?? null,
        confirmed: false,
        enqueue: step,
      }),
    }
  } catch (error) {
    return {
      ok: false,
      code: 'unknown',
      message:
        error instanceof Error
          ? error.message
          : 'Failed to subscribe to newsletter',
    }
  }
}
