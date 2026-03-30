import type { Metadata } from 'next'
import { Inter } from 'next/font/google'

import '@/styles/globals.css'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

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
    <html lang="en" className={`dark ${inter.variable}`}>
      <body className="bg-background text-foreground font-sans antialiased">
        {children}
      </body>
    </html>
  )
}
