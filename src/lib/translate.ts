import { createHash } from 'crypto'
import { unstable_cache } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { createArabicFillerCore, type ArabicFiller } from '@/lib/admin/arabic-filler'
import { getWorkerAi } from '@/server/cloudflare'
import { supabaseRateLimitStore } from '@/server/rate-limit-store'
import { translateWithAi } from './arabic-text'

// English -> Arabic through the Workers AI binding `AI` (src/lib/arabic-text.ts).
// No API key or secret. Without the binding (node tests, `next build`, a dev
// server without remote bindings) strict calls return null and the public path
// returns the English.

/** Thrown inside the cache so a failed translation is never cached. */
class TranslationUnavailable extends Error {}

async function translateEnToArUncached(text: string): Promise<string> {
  const translated = await translateWithAi(text, getWorkerAi())
  if (translated === null) throw new TranslationUnavailable()
  return translated
}

function hashText(text: string): string {
  return createHash('sha256').update(text).digest('hex')
}

/**
 * Public render path: translate English text to Arabic, cached 30 days per unique
 * string. Returns the original text when the binding is missing or the call fails
 * (a failure is not cached, so the next render tries again). No rate limit here.
 */
export async function translateEnToAr(text: string): Promise<string> {
  const trimmed = text.trim()
  if (!trimmed) return text

  try {
    return await unstable_cache(
      () => translateEnToArUncached(trimmed),
      ['translate-en-ar', hashText(trimmed)],
      { revalidate: 60 * 60 * 24 * 30 }
    )()
  } catch {
    return text
  }
}

/** Alias kept for callers of the old name. */
export const translateToArabic = translateEnToAr

/** Non-strict batch: each string through translateEnToAr (English where it fails). */
export async function translateBatchToArabic(texts: string[]): Promise<string[]> {
  if (texts.length === 0) return []
  return Promise.all(texts.map((t) => translateEnToAr(t)))
}

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
