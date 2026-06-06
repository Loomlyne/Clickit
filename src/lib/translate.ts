import 'server-only'

// ---------------------------------------------------------------------------
// DeepL English -> Arabic translation (server-only).
//
// Used to auto-fill empty `_ar` fields at save time (see admin/actions.ts) and
// by the backfill script. Best-effort: any failure returns the input unchanged
// so a save never breaks because translation was unavailable — the render-side
// pickLocalized() still falls back to the English text.
//
// The API key (DEEPL_API_KEY) lives in env, never in code. A key ending in
// `:fx` is a DeepL Free key and must hit the api-free.deepl.com host.
// ---------------------------------------------------------------------------

function deeplEndpoint(key: string): string {
  return key.endsWith(':fx')
    ? 'https://api-free.deepl.com/v2/translate'
    : 'https://api.deepl.com/v2/translate'
}

/**
 * Translate a batch of English strings to Arabic in one DeepL request.
 *
 * Preserves array order and length. Empty/whitespace inputs are passed through
 * untouched (DeepL is never asked to translate them). On any error the original
 * inputs are returned, so callers can use the result unconditionally.
 */
export async function translateBatchToArabic(texts: string[]): Promise<string[]> {
  const key = process.env.DEEPL_API_KEY
  if (!key) {
    console.warn('[translate] DEEPL_API_KEY not set — skipping translation')
    return texts
  }

  // Only send entries that actually have content; remember their positions so we
  // can stitch the translations back into the original shape.
  const indices: number[] = []
  const payload: string[] = []
  texts.forEach((t, i) => {
    if (t && t.trim()) {
      indices.push(i)
      payload.push(t)
    }
  })
  if (payload.length === 0) return texts

  try {
    const res = await fetch(deeplEndpoint(key), {
      method: 'POST',
      headers: {
        Authorization: `DeepL-Auth-Key ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: payload,
        source_lang: 'EN',
        target_lang: 'AR',
      }),
    })

    if (!res.ok) {
      const detail = await res.text().catch(() => '')
      console.error('[translate] DeepL error', res.status, detail.slice(0, 200))
      return texts
    }

    const data = (await res.json()) as {
      translations?: { text: string }[]
    }
    const out = [...texts]
    data.translations?.forEach((tr, i) => {
      const target = indices[i]
      if (target !== undefined && tr?.text) out[target] = tr.text
    })
    return out
  } catch (err) {
    console.error('[translate] DeepL request failed', err)
    return texts
  }
}

/** Single-string convenience wrapper around {@link translateBatchToArabic}. */
export async function translateToArabic(text: string): Promise<string> {
  const [out] = await translateBatchToArabic([text])
  return out ?? text
}

/**
 * Returns the Arabic value when present, otherwise the auto-translation of the
 * English source. If English is also empty, returns the (empty) Arabic value.
 * Used in save actions to fill a blank `_ar` field from its English sibling.
 */
export async function fillArabic(
  en: string | null | undefined,
  ar: string | null | undefined
): Promise<string | null> {
  const arTrimmed = (ar ?? '').trim()
  if (arTrimmed) return ar ?? null
  const enTrimmed = (en ?? '').trim()
  if (!enTrimmed) return ar ?? null
  return translateToArabic(enTrimmed)
}
