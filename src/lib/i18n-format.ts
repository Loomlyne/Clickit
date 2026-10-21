// Locale-aware formatting helpers (UI-SPEC Typography: mixed-script and digit
// rules). Pure: Intl only, no imports.
//
// Clock parts and number lists use the SAME locale tag next-intl uses ('en' /
// 'ar'), so every digit on the page comes from one numbering system. Dates use
// localeTag() instead (UI-SPEC: 'ar-AE' / 'en-GB').

/** m:ss under one hour, h:mm:ss from one hour. Bad input is 0:00. */
export function formatClock(seconds: number, locale: string): string {
  const total = Number.isFinite(seconds) && seconds > 0 ? Math.floor(seconds) : 0
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  const num = (n: number, minimumIntegerDigits: number) =>
    new Intl.NumberFormat(locale, { minimumIntegerDigits }).format(n)
  if (h > 0) return `${num(h, 1)}:${num(m, 2)}:${num(s, 2)}`
  return `${num(m, 1)}:${num(s, 2)}`
}

const FSI = '⁨' // first strong isolate
const PDI = '⁩' // pop directional isolate

/** Wrap user-generated text so its direction cannot leak into the sentence. */
export function isolate(text: string): string {
  return `${FSI}${text}${PDI}`
}

/** "1, 2, 4, and 7": localized numbers joined by a localized conjunction. */
export function formatNumberList(numbers: number[], locale: string): string {
  const nf = new Intl.NumberFormat(locale)
  return new Intl.ListFormat(locale, { style: 'long', type: 'conjunction' }).format(
    numbers.map((n) => nf.format(n))
  )
}

/** Date/time locale tag: ar-AE for Arabic, en-GB otherwise. */
export function localeTag(locale: string): string {
  return locale === 'ar' ? 'ar-AE' : 'en-GB'
}
