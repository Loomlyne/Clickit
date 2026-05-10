'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import { Link } from '@/i18n/navigation'
import { usePathname } from '@/i18n/navigation'
import { Menu } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { NAV_LINKS, NOW_LIVE, liveNavHref, liveNavIsExternal } from './nav-links'
import { AuthSection } from './auth-section'

interface MobileNavProps {
  initialUser?: { id: string; email: string } | null
  liveStreamUrl?: string | null
}

export function MobileNav({ initialUser, liveStreamUrl }: MobileNavProps = {}) {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()

  // Auto-close when route changes
  useEffect(() => {
    setOpen(false)
  }, [pathname])

  return (
    <Sheet open={open} onOpenChange={setOpen} modal={false}>
      <SheetTrigger
        aria-label="Open navigation menu"
        className="flex size-11 items-center justify-center rounded-full border border-[var(--line)] bg-[var(--bg-2)] text-white/70 transition-colors hover:bg-white/[0.06] hover:text-white md:hidden"
      >
        <Menu className="size-5" />
      </SheetTrigger>

      <SheetContent
        side="top"
        className="flex w-full flex-col rounded-b-[4px] border-x-0 border-t-0 p-0"
      >
        <SheetHeader className="border-b border-white/[0.06] px-6 py-5">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <Link
            href="/watch"
            aria-label="Clickit Story home"
            onClick={() => setOpen(false)}
            className="flex min-h-11 items-center"
          >
            <Image
              src="/brand/Clickit_final_logo.svg"
              alt="Clickit"
              width={136}
              height={56}
              className="h-8 w-auto"
              priority
            />
          </Link>
        </SheetHeader>

        <nav aria-label="Mobile navigation" className="flex flex-col gap-1 px-4 py-4">
          {(() => {
            const liveHref = liveNavHref(liveStreamUrl)
            const external = liveNavIsExternal(liveHref)
            const pillClass =
              'mb-1 flex min-h-[48px] items-center gap-3 rounded-full bg-[linear-gradient(135deg,#dc2626_0%,#b91c1c_100%)] px-4 text-[15px] font-semibold text-white shadow-sm ring-1 ring-white/15'
            const inner = (
              <>
                <span className="relative flex size-2.5 shrink-0" aria-hidden>
                  <span className="absolute inline-flex size-full animate-ping rounded-full bg-white/90 opacity-60" />
                  <span className="relative inline-flex size-2.5 rounded-full bg-white shadow-[0_0_6px_rgba(255,255,255,0.9)]" />
                </span>
                {NOW_LIVE.label}
              </>
            )
            return external ? (
              <a
                href={liveHref}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setOpen(false)}
                className={pillClass}
              >
                {inner}
              </a>
            ) : (
              <Link href={liveHref} onClick={() => setOpen(false)} className={pillClass}>
                {inner}
              </Link>
            )
          })()}
          {NAV_LINKS.map(({ label, href }) => {
            const isActive = href === '/' ? pathname === '/' : pathname.startsWith(href)
            return (
              <Link
                key={href}
                href={href}
                onClick={() => setOpen(false)}
                className={cn(
                  'flex min-h-[48px] items-center rounded-full px-4 text-[15px] font-medium tracking-normal transition-colors',
                  isActive
                    ? 'bg-white/[0.08] text-white'
                    : 'text-white/56 hover:bg-white/[0.04] hover:text-white'
                )}
              >
                {label}
              </Link>
            )
          })}
        </nav>

        {/* Auth section inside the sheet */}
        <div className="mt-auto border-t border-white/[0.06] px-4 py-4 flex flex-col gap-2">
          <AuthSection initialUser={initialUser} layout="sheet" />
        </div>
      </SheetContent>
    </Sheet>
  )
}
