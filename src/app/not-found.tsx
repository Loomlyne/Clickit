import '@/styles/globals.css'
import Link from 'next/link'
import en from '@/messages/en.json'

/**
 * Root not-found for paths outside any locale segment. The root layout renders
 * no <html>/<body> (they live in `[locale]/layout.tsx`), so this page supplies
 * its own and uses no next-intl context. Copy comes from the English
 * `notFound` messages.
 */
export default function RootNotFound() {
  const t = en.notFound
  return (
    <html lang="en" className="dark">
      <body className="bg-background text-foreground font-sans antialiased">
        <main className="flex min-h-[80vh] flex-col items-center justify-center px-6 text-center">
          <p className="text-brand-blue-safe text-8xl font-black">{t.code}</p>
          <h1 className="mt-4 text-2xl font-bold">{t.heading}</h1>
          <p className="text-muted-foreground mt-2">{t.description}</p>
          <Link href="/en" className="mt-8 underline">
            {t.goHome}
          </Link>
        </main>
      </body>
    </html>
  )
}
