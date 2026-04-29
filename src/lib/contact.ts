import { z } from 'zod'

export const supportMessageSchema = z.object({
  name: z.string().trim().min(2, 'nameMin'),
  email: z.string().trim().email('emailInvalid'),
  phone: z.string().trim().max(40).optional().or(z.literal('')),
  subject: z.string().trim().min(3, 'fieldRequired'),
  message: z.string().trim().min(10, 'messageMin'),
  terms: z.boolean().refine((value) => value === true, 'termsRequired'),
})

export const newsletterSignupSchema = z.object({
  email: z.string().trim().email('emailInvalid'),
  source: z.string().trim().min(1).max(64),
  interestSlug: z.string().trim().min(1).max(120).optional(),
  interestTitle: z.string().trim().min(1).max(160).optional(),
})

export type SupportMessageInput = z.infer<typeof supportMessageSchema>
export type NewsletterSignupInput = z.infer<typeof newsletterSignupSchema>

export type ActionErrorResult = {
  ok: false
  code: 'validation' | 'unknown'
  fieldErrors?: Record<string, string[] | undefined>
  message?: string
}

export type SupportSubmitResult =
  | {
      ok: true
      status: 'sent' | 'saved_email_failed'
    }
  | ActionErrorResult

export type NewsletterSignupResult =
  | {
      ok: true
      status: 'sent' | 'saved_email_failed' | 'already_subscribed' | 'updated_preferences'
    }
  | ActionErrorResult

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase()
}

export function buildNewsletterInterests(
  current: unknown,
  interest?: { slug?: string; title?: string }
) {
  const next = Array.isArray(current)
    ? current.filter((item): item is { slug: string; title?: string } => (
      typeof item === 'object' &&
      item !== null &&
      typeof (item as { slug?: unknown }).slug === 'string'
    ))
    : []

  if (!interest?.slug) return next

  const existing = next.find((item) => item.slug === interest.slug)
  if (existing) {
    if (interest.title) existing.title = interest.title
    return next
  }

  return [...next, { slug: interest.slug, title: interest.title }]
}
