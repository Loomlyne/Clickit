import type { Metadata, Viewport } from 'next'
import { Analytics } from '@vercel/analytics/next'
import { SpeedInsights } from '@vercel/speed-insights/next'
import { Plus_Jakarta_Sans, Cairo } from 'next/font/google'

import '@/styles/globals.css'
import { Toaster } from 'sonner'

const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-jakarta',
  weight: ['400', '500', '600', '700', '800'],
  display: 'swap',
})

const cairo = Cairo({
  subsets: ['arabic', 'latin'],
  variable: '--font-cairo',
  weight: ['400', '500', '600', '700', '900'],
  display: 'swap',
})

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
}

export const metadata: Metadata = {
  title: 'Clickit Story',
  description: 'Original shows from the UAE - streaming now',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={`dark ${jakarta.variable} ${cairo.variable}`}>
      <body className="bg-background text-foreground font-sans antialiased selection:bg-primary/70 selection:text-primary-foreground">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[60] focus:rounded-full focus:bg-card focus:px-4 focus:py-2 focus:text-foreground focus:ring-2 focus:ring-ring"
        >
          Skip to content
        </a>
        <main id="main">
          {children}
        </main>
        <Toaster
          theme="dark"
          toastOptions={{
            classNames: {
              toast: 'border border-white/10 bg-[#10131a] text-foreground shadow-[0_24px_80px_rgba(0,0,0,0.45)]',
              description: 'text-muted-foreground',
              actionButton: 'bg-primary text-primary-foreground',
              cancelButton: 'bg-secondary text-secondary-foreground',
            },
          }}
        />
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  )
}
