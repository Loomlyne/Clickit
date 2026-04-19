'use server'

import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'

import { LOCALE_COOKIE, SUPPORTED_LOCALES, type Locale } from '@/lib/locale'

/**
 * Server Action invoked by the locale switcher. Writes NEXT_LOCALE cookie
 * (1 year), then revalidates the layout so the entire tree re-renders with
 * the new lang/dir. The client component navigates back to the same path
 * after the action resolves.
 */
export async function setLocaleAction(next: Locale): Promise<{ ok: boolean }> {
  if (!(SUPPORTED_LOCALES as readonly string[]).includes(next)) {
    return { ok: false }
  }
  const store = await cookies()
  store.set({
    name: LOCALE_COOKIE,
    value: next,
    path: '/',
    maxAge: 60 * 60 * 24 * 365, // 1 year
    sameSite: 'lax',
    httpOnly: false, // readable by client analytics if needed; not sensitive
  })
  // Force the layout (and therefore <html lang/dir>) to re-render. Without
  // this, the cookie is set but server components keep the old locale until
  // a hard reload.
  revalidatePath('/', 'layout')
  return { ok: true }
}
