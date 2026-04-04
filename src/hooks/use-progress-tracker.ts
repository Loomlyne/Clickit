'use client'

import { useEffect, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

export function useProgressTracker(
  player: YT.Player | null,
  episodeId: string,
  userId: string | null
) {
  const lastSavedRef = useRef<number>(0)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const flush = useCallback(() => {
    if (!player || !userId) return
    try {
      const currentTime = Math.floor(player.getCurrentTime())
      const duration = Math.floor(player.getDuration())
      // Skip saves below 2 seconds to avoid overwriting with post-seek 0 values
      if (currentTime < 2 && lastSavedRef.current > 2) return
      if (Math.abs(currentTime - lastSavedRef.current) < 10) return

      const completed = currentTime / duration >= 0.95
      const supabase = createClient()
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
        .then(() => {
          lastSavedRef.current = currentTime
        })
    } catch {
      // Player may be destroyed; swallow error
    }
  }, [player, episodeId, userId])

  // Force flush (used for ended/pause events) - bypasses the 10-second delta check
  const forceFlush = useCallback(() => {
    if (!player || !userId) return
    try {
      const currentTime = Math.floor(player.getCurrentTime())
      const duration = Math.floor(player.getDuration())
      if (currentTime < 2 && lastSavedRef.current > 2) return

      const completed = currentTime / duration >= 0.95
      const supabase = createClient()
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
        .then(() => {
          lastSavedRef.current = currentTime
        })
    } catch {
      // Swallow
    }
  }, [player, episodeId, userId])

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
