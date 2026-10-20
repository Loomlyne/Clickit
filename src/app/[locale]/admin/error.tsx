'use client'

import { useEffect } from 'react'

// Admin-tree error boundary. The admin routes live OUTSIDE the (viewer) group,
// so without this a transient throw in the admin layout/page (e.g. a session
// hiccup on entry) bubbles to Next.js's unbranded default crash page
// ("This page couldn't load"). This keeps the admin inside a branded shell with
// a retry action. Copy is intentionally English-only so it renders even if i18n
// context failed to load.
export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('Admin route error:', error)
  }, [error])

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-6 text-center">
      <h1 className="text-2xl font-semibold tracking-tight text-[var(--text)]">
        Couldn&rsquo;t load admin
      </h1>
      <p className="mt-3 max-w-md text-sm text-[var(--text-dim)]">
        We hit a snag loading the admin area. Please try again.
      </p>
      <button
        onClick={reset}
        className="mt-8 rounded-full bg-white px-6 py-2.5 text-sm font-medium tracking-[0.06em] text-black uppercase transition-opacity hover:opacity-90"
      >
        Try again
      </button>
    </div>
  )
}
