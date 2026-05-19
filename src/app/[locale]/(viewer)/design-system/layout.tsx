'use client'

import { Link } from '@/i18n/navigation'
import { usePathname } from '@/i18n/navigation'

const sections = [
  { href: '/design-system/colors', label: 'Colors' },
  { href: '/design-system/typography', label: 'Typography' },
  { href: '/design-system/spacing', label: 'Spacing' },
  { href: '/design-system/components', label: 'Components' },
]

export default function DesignSystemLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()

  return (
    <div className="bg-background min-h-screen">
      <div className="mx-auto max-w-7xl px-4 pt-10 pb-20 md:px-8">
        <header className="rounded-[12px] border border-white/10 bg-white/[0.04] p-6 shadow-[0_28px_100px_rgba(0,0,0,0.28)] md:p-8">
          <p className="text-muted-foreground text-xs tracking-[0.24em] uppercase">
            Clickit Design System
          </p>
          <h1 className="text-foreground mt-3 text-4xl font-semibold tracking-tight">
            Apple restraint. Linear precision.
          </h1>
          <p className="text-muted-foreground mt-3 max-w-3xl text-sm leading-7 md:text-base">
            Internal reference for the redesign preview. These pages document
            the actual tokens, spacing rules, and primitives now used across
            viewer, admin, and shared shells.
          </p>
          <nav className="mt-6 flex flex-wrap gap-2">
            {sections.map((section) => (
              <Link
                key={section.href}
                href={section.href}
                className={`rounded-full px-4 py-2 text-sm transition-all ${
                  pathname === section.href
                    ? 'bg-white text-black shadow-[0_10px_30px_rgba(255,255,255,0.18)]'
                    : 'text-muted-foreground hover:text-foreground border border-white/10 bg-white/[0.03]'
                }`}
              >
                {section.label}
              </Link>
            ))}
          </nav>
        </header>
        <div className="pt-8">{children}</div>
      </div>
    </div>
  )
}
