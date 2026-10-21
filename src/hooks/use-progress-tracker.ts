'use client'

import { useEffect, useRef, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { shouldSaveProgress, videoMatchesFor } from '@/lib/watch/resume'

/** YT.PlayerState.PLAYING, spelled out so this file never needs the YT global at load. */
const PLAYING = 1

/**
 * Saves watch progress for the episode the player is on.
 *
 * `expectedVideoId` is the YouTube id of `episodeId`. After a switch the player
 * can still report the old video's clock for a moment, so a save is refused
 * until the player reports the expected id (or has been PLAYING since the
 * switch). When it is not given, the old behaviour stays: every readable clock
 * is saved.
 *
 * The caller flushes the outgoing episode (`forceFlush`) BEFORE `episodeId`
 * changes; this hook only flushes on unmount, not on a switch.
 */
export function useProgressTracker(
  player: YT.Player | null,
  episodeId: string,
  userId: string | null,
  expectedVideoId?: string
) {
  const lastSavedRef = useRef<number>(0)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  // True once the player has reported PLAYING for the current episode.
  const playingSinceSwitch = useRef(false)

  // One Supabase client per mount, not one per save. Previously flush() and
  // forceFlush() each called createClient() inside the callback, so a 60-minute
  // viewing session was instantiating the client 360+ times.
  const supabase = useMemo(() => createClient(), [])

  // Single save path; pass `force: true` to bypass the 10-second delta check
  // (used for visibility change + unmount). Merges two near-identical ~20-line
  // closures that were drifting apart.
  const save = useCallback(
    (opts: { force?: boolean } = {}) => {
      if (!player || !userId) return
      try {
        const currentTime = Math.floor(player.getCurrentTime())
        const duration = Math.floor(player.getDuration())

        // Whose clock is this? Unknown expected id keeps today's behaviour.
        const videoMatches =
          expectedVideoId === undefined
            ? true
            : videoMatchesFor({
                reportedVideoId: player.getVideoData?.()?.video_id,
                expectedVideoId,
                playingSinceSwitch: playingSinceSwitch.current,
              })

        // NaN/undefined from a not-yet-ready or destroying player, post-seek 0
        // over a real position, the 10-second delta and a foreign clock are all
        // refused in one place.
        if (
          !shouldSaveProgress({
            currentTime,
            duration,
            lastSaved: lastSavedRef.current,
            force: opts.force,
            videoMatches,
          })
        ) {
          return
        }

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
    },
    [player, episodeId, userId, supabase, expectedVideoId]
  )

  const flush = useCallback(() => save(), [save])
  const forceFlush = useCallback(() => save({ force: true }), [save])

  /** Set the "last saved" baseline, e.g. to the position a resumed episode starts from. */
  const resetBaseline = useCallback((seconds: number) => {
    lastSavedRef.current = Number.isFinite(seconds) && seconds > 0 ? Math.floor(seconds) : 0
  }, [])

  // A new episode starts a new baseline and has not been PLAYING yet.
  // Listens for PLAYING so a save only follows the new episode's own clock.
  useEffect(() => {
    lastSavedRef.current = 0
    playingSinceSwitch.current = false
    if (!player) return

    const onState = (event: YT.OnStateChangeEvent) => {
      if (event.data === PLAYING) playingSinceSwitch.current = true
    }
    try {
      player.addEventListener('onStateChange', onState)
    } catch {
      // Player already destroyed
    }
    return () => {
      try {
        player.removeEventListener('onStateChange', onState)
      } catch {
        // Player already destroyed
      }
    }
  }, [player, episodeId])

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

  // Flush on unmount only (route change). The cleanup reads the latest closure
  // through a ref, so this effect never re-runs on a switch.
  const latestFlush = useRef(forceFlush)
  useEffect(() => {
    latestFlush.current = forceFlush
  })
  useEffect(() => {
    return () => {
      latestFlush.current()
    }
  }, [])

  return { flush, forceFlush, resetBaseline }
}
