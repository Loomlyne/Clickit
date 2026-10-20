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
import { getAppConfig } from '@/lib/config'
import type { Json } from '@/lib/database.types'
import { sendTransactionalEmail } from '@/lib/resend'
import { createAdminClient } from '@/lib/supabase/admin'
import { clientIpFrom } from '@/server/client-ip'
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

async function getContactRecipient() {
  const config = await getAppConfig()
  return config.footer.contactEmail.trim() || 'contact@clickitstory.com'
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

    const recipient = await getContactRecipient()
    const mail = await sendTransactionalEmail({
      to: recipient,
      subject: `Support request: ${payload.subject}`,
      html: `
        <h2>New support message</h2>
        <p><strong>Name:</strong> ${escapeHtml(payload.name)}</p>
        <p><strong>Email:</strong> ${escapeHtml(payload.email)}</p>
        <p><strong>Phone:</strong> ${escapeHtml(payload.phone || 'Not provided')}</p>
        <p><strong>Subject:</strong> ${escapeHtml(payload.subject)}</p>
        <p><strong>Message:</strong></p>
        <p>${escapeHtml(payload.message).replace(/\n/g, '<br />')}</p>
      `,
      text: [
        'New support message',
        `Name: ${payload.name}`,
        `Email: ${payload.email}`,
        `Phone: ${payload.phone || 'Not provided'}`,
        `Subject: ${payload.subject}`,
        '',
        payload.message,
      ].join('\n'),
    })

    if (!mail.ok) {
      await admin
        .from('support_messages')
        .update({
          notification_status: 'failed',
          notification_error: mail.error,
        })
        .eq('id', inserted.id)

      return { ok: true, status: 'saved_email_failed' }
    }

    await admin
      .from('support_messages')
      .update({
        notification_status: 'sent',
        notification_error: null,
      })
      .eq('id', inserted.id)

    revalidatePath('/admin/inbox')
    return { ok: true, status: 'sent' }
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
    const normalizedEmail = normalizeEmail(payload.email)
    const { data: existing, error: existingError } = await admin
      .from('newsletter_subscribers')
      .select('id, interests, status')
      .eq('normalized_email', normalizedEmail)
      .maybeSingle()

    if (existingError) {
      throw new Error(existingError.message)
    }

    const nextInterests = buildNewsletterInterests(existing?.interests, {
      slug: payload.interestSlug,
      title: payload.interestTitle,
    })

    const row = {
      email: payload.email.trim(),
      normalized_email: normalizedEmail,
      source: payload.source,
      status: 'active',
      interests: nextInterests as Json,
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

    const shouldNotify =
      !existing ||
      existing.status !== 'active' ||
      JSON.stringify(existing.interests ?? []) !== JSON.stringify(nextInterests)

    if (!shouldNotify) {
      revalidatePath('/admin/inbox')
      return { ok: true, status: 'already_subscribed' }
    }

    const recipient = await getContactRecipient()
    const interestLabel =
      nextInterests.length > 0
        ? nextInterests.map((item) => item.title || item.slug).join(', ')
        : 'General newsletter'

    const mail = await sendTransactionalEmail({
      to: recipient,
      subject: `Newsletter signup: ${payload.email.trim()}`,
      html: `
        <h2>New newsletter signup</h2>
        <p><strong>Email:</strong> ${escapeHtml(payload.email.trim())}</p>
        <p><strong>Source:</strong> ${escapeHtml(payload.source)}</p>
        <p><strong>Interests:</strong> ${escapeHtml(interestLabel)}</p>
      `,
      text: [
        'New newsletter signup',
        `Email: ${payload.email.trim()}`,
        `Source: ${payload.source}`,
        `Interests: ${interestLabel}`,
      ].join('\n'),
    })

    if (!mail.ok) {
      await admin
        .from('newsletter_subscribers')
        .update({
          notification_status: 'failed',
          notification_error: mail.error,
        })
        .eq('id', saved.id)

      revalidatePath('/admin/inbox')
      return { ok: true, status: 'saved_email_failed' }
    }

    await admin
      .from('newsletter_subscribers')
      .update({
        notification_status: 'sent',
        notification_error: null,
      })
      .eq('id', saved.id)

    revalidatePath('/admin/inbox')
    return { ok: true, status: existing ? 'updated_preferences' : 'sent' }
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

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}
