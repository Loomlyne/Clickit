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
import { NAV_LINKS } from './nav-links'
import { AuthSection } from './auth-section'

interface MobileNavProps {
  initialUser?: { id: string; email: string } | null
}

export function MobileNav({ initialUser }: MobileNavProps = {}) {
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
        className="flex size-11 items-center justify-center rounded-[8px] border border-[var(--line)] bg-[var(--bg-2)] text-white/70 transition-colors hover:bg-white/[0.06] hover:text-white md:hidden"
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
            href="/"
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
          {NAV_LINKS.map(({ label, href }) => {
            const isActive = href === '/' ? pathname === '/' : pathname.startsWith(href)
            return (
              <Link
                key={href}
                href={href}
                onClick={() => setOpen(false)}
                className={cn(
                  'flex min-h-[48px] items-center rounded-[8px] px-4 text-[15px] font-medium tracking-normal transition-colors',
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
        <div className="mt-auto border-t border-white/[0.06] px-4 py-4 flex flex-col gap-2 [&_a]:w-full [&_a]:justify-center [&_a]:py-3 [&_a]:text-[14px]">
          <AuthSection initialUser={initialUser} />
        </div>
      </SheetContent>
    </Sheet>
  )
}
