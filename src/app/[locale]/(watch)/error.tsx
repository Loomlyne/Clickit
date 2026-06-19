'use client'

import { useEffect } from 'react'
import { useRouter } from '@/i18n/navigation'

// Watch player routes sit outside (viewer), so they need their own boundary —
// otherwise a player/data failure shows Next.js's generic "This page couldn't load".
export default function WatchError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const router = useRouter()

  useEffect(() => {
    console.error('Watch route error:', error)
  }, [error])

  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center bg-black px-6 text-center">
      <h1 className="text-2xl font-semibold tracking-tight text-white">
        Couldn&rsquo;t start playback
      </h1>
      <p className="mt-3 max-w-md text-sm text-white/60">
        We hit a snag loading this episode. Try again, or return to the catalog.
      </p>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          onClick={reset}
          className="rounded-full bg-white px-6 py-2.5 text-sm font-medium uppercase tracking-[0.06em] text-black transition-opacity hover:opacity-90"
        >
          Try again
        </button>
        <button
          type="button"
          onClick={() => router.push('/watch')}
          className="rounded-full border border-white/20 px-6 py-2.5 text-sm font-medium uppercase tracking-[0.06em] text-white transition-colors hover:bg-white/10"
        >
          Back to catalog
        </button>
      </div>
    </div>
  )
}
