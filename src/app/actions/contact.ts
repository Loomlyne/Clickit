'use server'

import { revalidatePath } from 'next/cache'

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

function validationError(fieldErrors: Record<string, string[] | undefined>) {
  return {
    ok: false as const,
    code: 'validation' as const,
    fieldErrors,
  }
}

async function getContactRecipient() {
  const config = await getAppConfig()
  return config.footer.contactEmail.trim() || 'contact@clickitstory.com'
}

export async function submitSupportMessage(input: SupportMessageInput): Promise<SupportSubmitResult> {
  const parsed = supportMessageSchema.safeParse(input)

  if (!parsed.success) {
    return validationError(parsed.error.flatten().fieldErrors)
  }

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
      message: error instanceof Error ? error.message : 'Failed to submit support message',
    }
  }
}

export async function subscribeToNewsletter(input: NewsletterSignupInput): Promise<NewsletterSignupResult> {
  const parsed = newsletterSignupSchema.safeParse(input)

  if (!parsed.success) {
    return validationError(parsed.error.flatten().fieldErrors)
  }

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
      throw new Error(upsertError?.message || 'Failed to save newsletter subscriber')
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
    const interestLabel = nextInterests.length > 0
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
      message: error instanceof Error ? error.message : 'Failed to subscribe to newsletter',
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
