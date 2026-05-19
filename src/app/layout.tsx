/**
 * Root layout — intentionally minimal.
 *
 * `<html>` and `<body>` live on `src/app/[locale]/layout.tsx` because Next.js
 * 16 App Router allows exactly one layout in the tree to own them. Locking
 * them to the [locale] layout (not this root) lets us set `lang={locale}` and
 * `dir={dirFor(locale)}` from the URL segment directly — which is both the
 * next-intl recommended pattern and the source of truth for I18N-07.
 *
 * This file must still exist per Next.js root-layout requirement. Do NOT add
 * providers here — they belong inside the locale wrapper so they can read the
 * active locale.
 */
export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
