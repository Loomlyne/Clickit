'use client'

import { useEffect, useRef, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'

export function useProgressTracker(
  player: YT.Player | null,
  episodeId: string,
  userId: string | null
) {
  const lastSavedRef = useRef<number>(0)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // One Supabase client per mount, not one per save. Previously flush() and
  // forceFlush() each called createClient() inside the callback, so a 60-minute
  // viewing session was instantiating the client 360+ times.
  const supabase = useMemo(() => createClient(), [])

  // Single save path; pass `force: true` to bypass the 10-second delta check
  // (used for visibility change + unmount). Merges two near-identical ~20-line
  // closures that were drifting apart.
  const save = useCallback((opts: { force?: boolean } = {}) => {
    if (!player || !userId) return
    try {
      const currentTime = Math.floor(player.getCurrentTime())
      const duration = Math.floor(player.getDuration())
      // Guard against NaN/undefined from a not-yet-ready or destroying player.
      // The unmount flush fires on every navigation away from /watch; if the
      // player is mid-teardown, getCurrentTime/getDuration return NaN, which
      // JSON-serializes to null and violates progress_seconds NOT NULL → 400.
      if (!Number.isFinite(currentTime) || currentTime < 0) return
      if (!Number.isFinite(duration) || duration <= 0) return
      // Skip saves below 2 seconds to avoid overwriting with post-seek 0 values
      if (currentTime < 2 && lastSavedRef.current > 2) return
      if (!opts.force && Math.abs(currentTime - lastSavedRef.current) < 10) return

      const completed = currentTime / duration >= 0.95
      supabase
        .from('watch_progress')
        .upsert(
          {
            user_id: userId,
            episode_id: episodeId,
            progress_seconds: currentTime,
            duration_seconds: duration,
            completed,
          },
          { onConflict: 'user_id,episode_id' }
        )
        .then(({ error }) => {
          if (error) {
            console.warn('[watch_progress] save failed:', error.message)
            return
          }
          lastSavedRef.current = currentTime
        })
    } catch {
      // Player may be destroyed; swallow error
    }
  }, [player, episodeId, userId, supabase])

  const flush = useCallback(() => save(), [save])
  const forceFlush = useCallback(() => save({ force: true }), [save])

  // Start 10-second interval
  useEffect(() => {
    if (!player || !userId) return

    intervalRef.current = setInterval(flush, 10_000)

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [player, userId, flush])

  // Visibility change handler
  useEffect(() => {
    if (!player || !userId) return

    const handleVisibility = () => {
      if (document.hidden) forceFlush()
    }

    document.addEventListener('visibilitychange', handleVisibility)
    return () => document.removeEventListener('visibilitychange', handleVisibility)
  }, [player, userId, forceFlush])

  // Flush on unmount (route change)
  useEffect(() => {
    return () => { forceFlush() }
  }, [forceFlush])

  return { flush, forceFlush }
}
