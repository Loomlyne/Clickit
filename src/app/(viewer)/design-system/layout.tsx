'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

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
    <div className="min-h-screen bg-background">
      <header className="border-b border-border px-8 py-6">
        <h1 className="text-3xl font-bold text-foreground">
          CIT Design System
        </h1>
        <p className="mt-2 text-text-secondary">
          Color palette, typography scale, and component primitives for the
          Clickit Story streaming platform.
        </p>
        <nav className="mt-4 flex gap-6">
          {sections.map((section) => (
            <Link
              key={section.href}
              href={section.href}
              className={`text-sm transition-colors ${
                pathname === section.href
                  ? 'font-medium text-foreground'
                  : 'text-brand-blue-safe hover:text-foreground'
              }`}
            >
              {section.label}
            </Link>
          ))}
        </nav>
      </header>
      <main className="px-8 py-8">{children}</main>
    </div>
  )
}
