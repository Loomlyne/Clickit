'use client'

import { Toaster } from 'sonner'

import { usePathname } from '@/i18n/navigation'

/**
 * The site-wide toast host, except on the watch route (UI-SPEC 3.1). On
 * /watch/* no Toaster is mounted at all, so no toast (including one fired by
 * shared code) can ever appear over the YouTube player. Watch feedback is
 * inline through the shell's polite live region.
 *
 * next-intl's usePathname returns the path without the locale prefix.
 */
export function RouteScopedToaster() {
  const pathname = usePathname()
  if (pathname.startsWith('/watch/')) return null

  return (
    <Toaster
      theme="dark"
      toastOptions={{
        classNames: {
          toast:
            'border border-white/10 bg-[var(--bg-1)] text-foreground shadow-popover',
          description: 'text-muted-foreground',
          actionButton: 'bg-primary text-primary-foreground',
          cancelButton: 'bg-secondary text-secondary-foreground',
        },
      }}
    />
  )
}
