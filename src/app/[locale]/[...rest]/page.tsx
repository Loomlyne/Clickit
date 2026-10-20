import { notFound } from 'next/navigation'

/**
 * Catch-all for unknown paths under a locale. Calling notFound() here renders
 * `src/app/[locale]/not-found.tsx` inside the locale layout (html, body,
 * messages), which is the next-intl documented pattern for a localized 404.
 */
export default function CatchAllPage() {
  notFound()
}
