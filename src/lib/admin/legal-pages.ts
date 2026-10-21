// Legal page save (review item 12, PR #29; Koss 2026-10-21 in the question form: legal pages
// Arabic = "AI draft, admin approves") with the updated_at compare-and-swap (item 8).
//
//   title_ar / content_ar             published Arabic, shown on /ar only when ar_reviewed
//   title_ar_draft / content_ar_draft unreviewed Arabic (AI or an admin edit left unticked)
//   ar_reviewed                       an admin approved the published Arabic
//
// Save rules:
// - Ticked "Arabic reviewed": the Arabic in the form is published (title_ar/content_ar),
//   drafts cleared, ar_reviewed true. An empty Arabic body with a non-empty English body is
//   refused (nothing to approve). The AI is never called on this path.
// - Unticked: the Arabic in the form becomes the draft; a blank field is drafted by the AI
//   (title within its 200 max). The published Arabic is left as it was (not shown).
// - English edited but its Arabic not edited: the Arabic is a translation of the old text, so
//   it is dropped and re-drafted by the AI and the review resets to false, even if ticked.
//
// No next/*, server-only or '@/' imports: node --test loads this file.
import { z } from 'zod'
import { arabicMaxLengths } from './arabic-limits.ts'
import { legalArabicForEditor } from '../legal-arabic.ts'
import { SAVE_CONFLICT, rowVersion } from './row-version.ts'
import type { AdminDb, ArabicFill } from './ports'

export { legalArabicForEditor }

export type LegalPageRow = {
  id: string
  slug: string
  title: string
  content: string
  title_ar: string | null
  content_ar: string | null
  title_ar_draft: string | null
  content_ar_draft: string | null
  ar_reviewed: boolean
  sort_order: number
  updated_at: string
}

export const LEGAL_PAGE_COLUMNS =
  'id, slug, title, content, title_ar, content_ar, title_ar_draft, content_ar_draft, ar_reviewed, sort_order, updated_at'

/** Server error line (admin actions return English errors; shown as a toast). */
// The admin form maps this error to the localised admin.settings.legalArReviewRequired.
export { LEGAL_REVIEW_REQUIRED } from '../legal-arabic.ts'
import { LEGAL_REVIEW_REQUIRED } from '../legal-arabic.ts'

export const legalPageSchema = z.object({
  id: z.string().uuid().optional(),
  slug: z
    .string()
    .min(1, 'Slug is required')
    .max(80)
    .regex(/^[a-z0-9-]+$/, 'Lowercase letters, numbers, hyphens only'),
  title: z.string().min(1, 'Title is required').max(200),
  content: z.string(),
  title_ar: z.string().max(200).optional().nullable(),
  content_ar: z.string().optional().nullable(),
  ar_reviewed: z.boolean().default(false),
  sort_order: z.number().int().min(0).default(0),
})

const legalArMax = arabicMaxLengths(legalPageSchema)


export type LegalSaveResult = {
  success: boolean
  error?: string
  data?: LegalPageRow
  /** The new updated_at after an update, for the next save from the same editor. */
  updatedAt?: string
}

const norm = (v: string | null | undefined) => (v ?? '').trim()

export async function upsertLegalPageCore(
  db: AdminDb,
  deps: { fill: ArabicFill },
  raw: unknown,
  expectedUpdatedAt?: unknown
): Promise<LegalSaveResult> {
  const parsed = legalPageSchema.safeParse(raw)
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]!.message }
  const { id, ar_reviewed: wantReviewed, title_ar, content_ar, ...english } = parsed.data

  // Update: the editor's updated_at is required and checked before any read or AI call.
  let expected: string | null = null
  if (id) {
    const version = rowVersion(expectedUpdatedAt)
    if (!version.ok) return { success: false, error: version.error }
    expected = version.value.expected
  }

  let current: LegalPageRow | null = null
  if (id) {
    const { data, error } = await db
      .from('legal_pages')
      .select(LEGAL_PAGE_COLUMNS)
      .eq('id', id)
      .maybeSingle()
    if (error) return { success: false, error: error.message }
    if (!data) return { success: false, error: 'Legal page not found.' }
    current = data as unknown as LegalPageRow
    if (current.updated_at !== expected) return { success: false, error: SAVE_CONFLICT }
  }

  // English edited, Arabic left as the editor showed it: that Arabic translates the old text.
  const shown = current ? legalArabicForEditor(current) : { title_ar: '', content_ar: '' }
  let titleAr = norm(title_ar)
  let contentAr = norm(content_ar)
  const titleStale =
    !!current && english.title !== current.title && titleAr !== '' && titleAr === norm(shown.title_ar)
  const contentStale =
    !!current && english.content !== current.content && contentAr !== '' && contentAr === norm(shown.content_ar)
  if (titleStale) titleAr = ''
  if (contentStale) contentAr = ''
  const reviewed = wantReviewed && !titleStale && !contentStale

  let patch: Record<string, unknown>
  if (reviewed) {
    if (!contentAr && english.content.trim()) return { success: false, error: LEGAL_REVIEW_REQUIRED }
    patch = {
      ...english,
      title_ar: titleAr || null,
      content_ar: contentAr || null,
      title_ar_draft: null,
      content_ar_draft: null,
      ar_reviewed: true,
    }
  } else {
    patch = {
      ...english,
      title_ar_draft: await deps.fill(english.title, titleAr || null, legalArMax.title_ar),
      content_ar_draft: await deps.fill(english.content, contentAr || null),
      ar_reviewed: false,
    }
  }

  if (!current) {
    const { data, error } = await db
      .from('legal_pages')
      .insert(patch as never)
      .select(LEGAL_PAGE_COLUMNS)
      .single()
    if (error) return { success: false, error: error.message }
    return { success: true, data: data as unknown as LegalPageRow }
  }

  // Atomic: lands only while the row still holds the updated_at the editor loaded.
  const { data, error } = await db
    .from('legal_pages')
    .update(patch as never)
    .eq('id', current.id)
    .eq('updated_at', expected as string)
    .select(LEGAL_PAGE_COLUMNS)
  if (error) return { success: false, error: error.message }
  if (!Array.isArray(data) || data.length !== 1) return { success: false, error: SAVE_CONFLICT }
  const saved = data[0] as unknown as LegalPageRow
  return { success: true, data: saved, updatedAt: saved.updated_at }
}
