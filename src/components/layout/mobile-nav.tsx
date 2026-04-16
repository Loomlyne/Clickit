'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
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

export function MobileNav() {
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
        className="flex size-11 items-center justify-center rounded-[16px] border border-white/10 bg-white/[0.03] text-white/70 transition-colors hover:bg-white/[0.06] hover:text-white md:hidden"
      >
        <Menu className="size-5" />
      </SheetTrigger>

      <SheetContent side="left" className="w-[280px] p-0 sm:max-w-[320px]">
        <SheetHeader className="border-b border-white/[0.06] px-6 py-5">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <Link href="/" aria-label="Clickit Story home" onClick={() => setOpen(false)}>
            <Image
              src="/brand/Clickit_final_logo.svg"
              alt="Clickit Story"
              width={124}
              height={32}
              className="h-8 w-auto"
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
                  'flex min-h-[48px] items-center rounded-[14px] px-4 text-[15px] font-medium tracking-[-0.01em] transition-colors',
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
      </SheetContent>
    </Sheet>
  )
}
