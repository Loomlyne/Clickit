const ARABIC_RE = /[؀-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-﻿]/

export function hasArabicScript(text: string): boolean {
  return ARABIC_RE.test(text)
}

/** Returns the trimmed translation only if it is real Arabic and differs from the source. */
export function acceptArabicTranslation(source: string, translated: string | null | undefined): string | null {
  const t = translated?.trim()
  if (!t) return null
  if (t === source.trim()) return null
  if (!hasArabicScript(t)) return null
  return t
}

export async function translateBatchStrictCore(
  texts: string[],
  deps: { apiKey: string | undefined; fetchImpl: typeof fetch }
): Promise<(string | null)[]> {
  const trimmed = texts.map((t) => t.trim())
  const none = texts.map(() => null)
  if (!deps.apiKey || trimmed.every((t) => !t)) return none

  try {
    const res = await deps.fetchImpl(
      `https://translation.googleapis.com/language/translate/v2?key=${encodeURIComponent(deps.apiKey)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ q: trimmed.filter(Boolean), target: 'ar', source: 'en', format: 'text' }),
      }
    )
    if (!res.ok) return none
    const data = (await res.json()) as {
      data?: { translations?: Array<{ translatedText?: string }> }
    }
    const translations = data?.data?.translations ?? []
    let i = 0
    return trimmed.map((text) => {
      if (!text) return null
      const translated = translations[i]?.translatedText
      i += 1
      return acceptArabicTranslation(text, translated)
    })
  } catch {
    return none
  }
}
