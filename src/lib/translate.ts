import { createAdminClient } from '@/lib/supabase/admin'
import { createArabicFillerCore, type ArabicFiller } from '@/lib/admin/arabic-filler'
import { getWorkerAi } from '@/server/cloudflare'
import { supabaseRateLimitStore } from '@/server/rate-limit-store'

// English -> Arabic through the Workers AI binding `AI` (src/lib/arabic-text.ts), for admin
// saves only. No API key or secret. Without the binding (node tests, `next build`, a dev
// server without remote bindings) every call returns null. Public pages never translate on a
// viewer request (review item 6, PR #29): they render the stored *_ar or the English
// (localizedField in src/lib/locale.ts).

/**
 * Per-admin filler for admin saves: strict (null, never English, never cached),
 * every AI call behind the admin's rate limit (translate-ar, 60 per 10 minutes).
 * `userId` must be the id of the admin the action already authenticated.
 */
export function createArabicFiller(userId: string): ArabicFiller {
  return createArabicFillerCore({
    userId,
    getAi: async () => getWorkerAi(),
    getStore: () => supabaseRateLimitStore(createAdminClient()),
  })
}

/**
 * Strict batch translation: null per slot on any failure, never English, never cached.
 * Without `opts.userId` there is no admin to rate-limit, so it fails closed (all null).
 */
export async function translateBatchToArabicStrict(
  texts: string[],
  opts: { userId?: string } = {}
): Promise<(string | null)[]> {
  if (texts.length === 0) return []
  if (!opts.userId) return texts.map(() => null)
  return createArabicFiller(opts.userId).fillBatch(texts)
}

export async function translateToArabicStrict(
  text: string,
  opts: { userId?: string } = {}
): Promise<string | null> {
  const [result] = await translateBatchToArabicStrict([text], opts)
  return result ?? null
}

/**
 * Return the existing Arabic value when present; otherwise auto-translate English.
 * Returns null when translation fails (never English). Admin actions use
 * createArabicFiller(adminId).fill, which also counts what could not be filled.
 */
export async function fillArabic(
  en: string | null | undefined,
  ar: string | null | undefined,
  opts: { userId?: string } = {}
): Promise<string | null> {
  if (ar?.trim()) return ar.trim()
  if (!en?.trim()) return null
  return translateToArabicStrict(en, opts)
}
