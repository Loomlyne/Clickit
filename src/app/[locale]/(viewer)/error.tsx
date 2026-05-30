'use client'

import { useEffect } from 'react'

// Viewer-tree error boundary. Without this, a DB/network failure in any viewer
// page renders Next.js's unbranded default crash page. This keeps users inside
// the Clickit shell with a retry action. Copy is intentionally English-only:
// it must render even if i18n context failed to load.
export default function ViewerError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('Viewer route error:', error)
  }, [error])

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-6 text-center">
      <h1 className="text-2xl font-semibold tracking-tight text-white">
        Something went wrong
      </h1>
      <p className="mt-3 max-w-md text-sm text-white/60">
        We hit a snag loading this page. Please try again.
      </p>
      <button
        onClick={reset}
        className="mt-8 rounded-full bg-white px-6 py-2.5 text-sm font-medium uppercase tracking-[0.06em] text-black transition-opacity hover:opacity-90"
      >
        Try again
      </button>
    </div>
  )
}
