// Public render of an admin-managed legal page (review item 12, PR #29; Koss 2026-10-21:
// "AI draft, admin approves"). The Arabic title and body are shown on /ar only after an admin
// ticked "Arabic reviewed"; until then /ar shows the English legal text. Draft columns are
// never read here. Pure: node --test loads it.
import { pickLocalized, type Locale } from './locale.ts'

/** Server error when "Arabic reviewed" is ticked with no Arabic body; the editor shows admin.settings.legalArReviewRequired instead. */
export const LEGAL_REVIEW_REQUIRED = 'Add the Arabic text before ticking "Arabic reviewed".'

export type LegalPageText = {
  title: string
  content: string
  title_ar: string | null
  content_ar: string | null
  ar_reviewed?: boolean | null
}

export function legalPageForLocale(
  page: LegalPageText,
  locale: Locale
): { title: string; content: string } {
  if (locale !== 'ar' || page.ar_reviewed !== true) {
    return { title: page.title, content: page.content }
  }
  return {
    title: pickLocalized('ar', page.title, page.title_ar),
    content: pickLocalized('ar', page.content, page.content_ar),
  }
}

/**
 * The Arabic the admin editor shows: the published text when reviewed, else the draft (or
 * the old published text). Lives here, not in src/lib/admin/legal-pages.ts, so the client
 * editor does not bundle zod and the server save core.
 */
export function legalArabicForEditor(row: {
  title_ar: string | null
  content_ar: string | null
  title_ar_draft: string | null
  content_ar_draft: string | null
  ar_reviewed: boolean
}): { title_ar: string; content_ar: string } {
  if (row.ar_reviewed) return { title_ar: row.title_ar ?? '', content_ar: row.content_ar ?? '' }
  return {
    title_ar: row.title_ar_draft ?? row.title_ar ?? '',
    content_ar: row.content_ar_draft ?? row.content_ar ?? '',
  }
}
