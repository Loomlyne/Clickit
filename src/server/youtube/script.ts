// Script routing for YouTube text (D-04: no translation) and the single
// "Needs English title" rule. Pure and self-contained so it does not depend on
// Phase 2's arabic-text.ts. React renders the result as plain text (T-06-13).

export const TITLE_MAX = 100
export const DESCRIPTION_MAX = 1000

const ARABIC_LETTER = /\p{Script=Arabic}/u
const ANY_LETTER = /\p{L}/u

export function containsArabicScript(text: string): boolean {
  return typeof text === 'string' && ARABIC_LETTER.test(text)
}

/** 'ar' when Arabic letters are at least half of all letters; digits and punctuation are ignored. */
export function dominantScript(text: string): 'ar' | 'other' {
  if (typeof text !== 'string') return 'other'
  let arabic = 0
  let letters = 0
  for (const ch of text) {
    if (!ANY_LETTER.test(ch)) continue
    letters++
    if (ARABIC_LETTER.test(ch)) arabic++
  }
  return letters > 0 && arabic * 2 >= letters ? 'ar' : 'other'
}

/** Trim, then cap by code points so a surrogate pair is never split. */
function clean(text: string | undefined | null, max: number): string {
  return Array.from((text ?? '').trim()).slice(0, max).join('')
}

export type RoutedText = {
  title: string
  title_ar: string | null
  description: string
  description_ar: string | null
}

/**
 * Arabic-dominant text goes to the *_ar field (the title is mirrored into
 * `title`, which is required; the description column is left empty). Anything
 * else goes to title/description with the *_ar field null. Title and
 * description are routed independently. Nothing is translated.
 */
export function routeYouTubeText(input: {
  title: string
  description: string
}): RoutedText {
  const title = clean(input.title, TITLE_MAX)
  const description = clean(input.description, DESCRIPTION_MAX)
  const titleAr = dominantScript(title) === 'ar'
  const descriptionAr = dominantScript(description) === 'ar'
  return {
    title,
    title_ar: titleAr ? title : null,
    description: descriptionAr ? '' : description,
    description_ar: descriptionAr ? description : null,
  }
}

/**
 * The one rule behind every "Needs English title" mark (import success state,
 * episode form, admin table, scheduler warnings): the English title is
 * Arabic-dominant, or it mirrors the Arabic title.
 */
export function needsEnglishTitle(input: {
  title: string
  title_ar: string | null
}): boolean {
  const { title, title_ar } = input
  return (
    dominantScript(title) === 'ar' ||
    (title_ar != null && title_ar !== '' && title === title_ar)
  )
}
