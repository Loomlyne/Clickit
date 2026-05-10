'use client'

import { useEffect } from 'react'
import { initBotId } from 'botid/client/core'
import { usePathname } from '@/i18n/navigation'
import { routing } from '@/i18n/routing'

/**
 * Initializes BotID on the client. Placed on /auth so the challenge token
 * is collected before a user attempts sign-in or sign-up. The Server Actions
 * in auth/actions.ts verify the resulting headers.
 *
 * Path must include the locale prefix (e.g. /en/auth): Server Actions POST to
 * the full URL — usePathname() from next-intl omits locale when localePrefix
 * is "always". We register POST for every supported locale so the protected
 * path matches the actual request regardless of active locale.
 */
export function BotIdInit() {
  const pathname = usePathname()

  useEffect(() => {
    const normalized = pathname.startsWith('/') ? pathname : `/${pathname}`
    const protect = routing.locales.map((loc) => ({
      path: normalized === '/' ? `/${loc}` : `/${loc}${normalized}`,
      method: 'POST' as const,
    }))
    initBotId({ protect })
  }, [pathname])

  return null
}
