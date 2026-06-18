import { createHash } from 'crypto'
import { unstable_cache } from 'next/cache'

async function translateEnToArUncached(text: string): Promise<string> {
  const key = process.env.GOOGLE_TRANSLATE_API_KEY
  if (!key || !text.trim()) return text

  try {
    const res = await fetch(
      `https://translation.googleapis.com/language/translate/v2?key=${encodeURIComponent(key)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          q: text,
          target: 'ar',
          source: 'en',
          format: 'text',
        }),
      }
    )
    if (!res.ok) return text
    const data = (await res.json()) as {
      data?: { translations?: Array<{ translatedText?: string }> }
    }
    return data?.data?.translations?.[0]?.translatedText ?? text
  } catch {
    return text
  }
}

async function translateBatchToArabicUncached(texts: string[]): Promise<string[]> {
  const key = process.env.GOOGLE_TRANSLATE_API_KEY
  const trimmed = texts.map((t) => t.trim())
  if (!key || trimmed.every((t) => !t)) return texts

  try {
    const res = await fetch(
      `https://translation.googleapis.com/language/translate/v2?key=${encodeURIComponent(key)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          q: trimmed.filter(Boolean),
          target: 'ar',
          source: 'en',
          format: 'text',
        }),
      }
    )
    if (!res.ok) return texts
    const data = (await res.json()) as {
      data?: { translations?: Array<{ translatedText?: string }> }
    }
    const translations = data?.data?.translations ?? []
    let i = 0
    return trimmed.map((text) => {
      if (!text) return text
      const translated = translations[i]?.translatedText
      i += 1
      return translated?.trim() ? translated : text
    })
  } catch {
    return texts
  }
}

function hashText(text: string): string {
  return createHash('sha256').update(text).digest('hex')
}

/**
 * Translate English text to Arabic, cached per unique string.
 * Returns the original text when the API key is missing or the call fails.
 */
export function translateEnToAr(text: string): Promise<string> {
  const trimmed = text.trim()
  if (!trimmed) return Promise.resolve(text)

  return unstable_cache(
    () => translateEnToArUncached(trimmed),
    ['translate-en-ar', hashText(trimmed)],
    { revalidate: 60 * 60 * 24 * 30 }
  )()
}

/** Alias used by admin server actions. */
export const translateToArabic = translateEnToAr

/**
 * Batch-translate multiple English strings to Arabic in one API call.
 * Used by admin forms (ticker, etc.) to fill blank `_ar` fields on save.
 */
export async function translateBatchToArabic(texts: string[]): Promise<string[]> {
  if (texts.length === 0) return []
  if (texts.length === 1) {
    return [await translateEnToAr(texts[0]!)]
  }
  return translateBatchToArabicUncached(texts)
}

/**
 * Return the existing Arabic value when present; otherwise auto-translate English.
 */
export async function fillArabic(
  en: string | null | undefined,
  ar: string | null | undefined
): Promise<string | null> {
  if (ar?.trim()) return ar.trim()
  if (!en?.trim()) return null
  return translateEnToAr(en)
}
