'use client'

import { motion } from 'motion/react'
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react'

const ease = [0.22, 1, 0.36, 1] as const

const MIN_VISIBLE_PLAY_MS = 5000
const PLAY_START_GRACE_MS = 2200
const PLAY_RETRY_INTERVAL_MS = 180
const VIDEO_ERROR_EXIT_GRACE_MS = 360

let hasShownPreloadThisDocument = false

export function EntryPreload() {
  const [runPreload, setRunPreload] = useState<boolean | null>(null)
  const [phase, setPhase] = useState<'entering' | 'playing' | 'exiting' | 'done'>(
    'entering'
  )
  const phaseRef = useRef(phase)
  phaseRef.current = phase
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const playbackConfirmedRef = useRef(false)
  const holdSatisfiedRef = useRef(false)
  const endedBeforeHoldRef = useRef(false)
  const hasTriggeredExitRef = useRef(false)
  const holdTimerRef = useRef<number | null>(null)
  const startupDeadlineTimerRef = useRef<number | null>(null)
  const retryTimerRef = useRef<number | null>(null)
  const errorExitTimerRef = useRef<number | null>(null)

  const clearHoldTimer = useCallback(() => {
    if (holdTimerRef.current === null) return
    window.clearTimeout(holdTimerRef.current)
    holdTimerRef.current = null
  }, [])

  const clearStartupDeadline = useCallback(() => {
    if (startupDeadlineTimerRef.current === null) return
    window.clearTimeout(startupDeadlineTimerRef.current)
    startupDeadlineTimerRef.current = null
  }, [])

  const clearRetryTimer = useCallback(() => {
    if (retryTimerRef.current === null) return
    window.clearInterval(retryTimerRef.current)
    retryTimerRef.current = null
  }, [])

  const clearErrorExitTimer = useCallback(() => {
    if (errorExitTimerRef.current === null) return
    window.clearTimeout(errorExitTimerRef.current)
    errorExitTimerRef.current = null
  }, [])

  const triggerExit = useCallback(() => {
    if (hasTriggeredExitRef.current) return
    hasTriggeredExitRef.current = true
    clearHoldTimer()
    clearStartupDeadline()
    clearRetryTimer()
    clearErrorExitTimer()
    setPhase('exiting')
  }, [clearErrorExitTimer, clearHoldTimer, clearRetryTimer, clearStartupDeadline])

  const confirmPlayback = useCallback(() => {
    if (playbackConfirmedRef.current) return
    playbackConfirmedRef.current = true
    clearStartupDeadline()
    clearRetryTimer()
    clearErrorExitTimer()

    holdTimerRef.current = window.setTimeout(() => {
      holdSatisfiedRef.current = true
      if (endedBeforeHoldRef.current) {
        triggerExit()
      }
    }, MIN_VISIBLE_PLAY_MS)
  }, [clearErrorExitTimer, clearRetryTimer, clearStartupDeadline, triggerExit])

  const tryStartPlayback = useCallback(() => {
    if (phaseRef.current !== 'playing') return

    const video = videoRef.current
    if (!video) {
      triggerExit()
      return
    }

    video.muted = true
    video.controls = false
    video.loop = false
    video.currentTime = 0
    video.play().catch(() => {
      // Retry loop handles follow-up attempts during startup grace.
    })

    if (startupDeadlineTimerRef.current === null) {
      startupDeadlineTimerRef.current = window.setTimeout(() => {
        if (!playbackConfirmedRef.current) {
          triggerExit()
        }
      }, PLAY_START_GRACE_MS)
    }

    if (retryTimerRef.current === null) {
      retryTimerRef.current = window.setInterval(() => {
        if (phaseRef.current !== 'playing') {
          clearRetryTimer()
          return
        }

        if (playbackConfirmedRef.current) {
          clearRetryTimer()
          return
        }

        const nextVideo = videoRef.current
        if (!nextVideo) return
        nextVideo.play().catch(() => {
          // Keep retrying until startup grace expires.
        })
      }, PLAY_RETRY_INTERVAL_MS)
    }
  }, [clearRetryTimer, triggerExit])

  useLayoutEffect(() => {
    if (hasShownPreloadThisDocument) {
      setRunPreload(false)
      return
    }

    const entries = performance.getEntriesByType('navigation')
    const nav = entries[0] as PerformanceNavigationTiming | undefined
    const type = nav?.type ?? 'navigate'
    const run = type === 'navigate' || type === 'reload'
    setRunPreload(run)
    if (run) hasShownPreloadThisDocument = true
  }, [])

  useEffect(() => {
    if (runPreload !== true) return
    if (phase !== 'playing') return

    hasTriggeredExitRef.current = false
    playbackConfirmedRef.current = false
    holdSatisfiedRef.current = false
    endedBeforeHoldRef.current = false
    clearHoldTimer()
    clearStartupDeadline()
    clearRetryTimer()
    clearErrorExitTimer()
    tryStartPlayback()
  }, [
    phase,
    runPreload,
    clearErrorExitTimer,
    clearHoldTimer,
    clearRetryTimer,
    clearStartupDeadline,
    tryStartPlayback,
  ])

  useEffect(() => {
    return () => {
      clearHoldTimer()
      clearStartupDeadline()
      clearRetryTimer()
      clearErrorExitTimer()
    }
  }, [clearErrorExitTimer, clearHoldTimer, clearRetryTimer, clearStartupDeadline])

  const isVisible = useMemo(
    () => runPreload === true && phase !== 'done',
    [phase, runPreload]
  )

  useEffect(() => {
    if (!isVisible) return

    const { body, documentElement } = document
    const prevHtmlOverflow = documentElement.style.overflow
    const prevBodyOverflow = body.style.overflow

    documentElement.style.overflow = 'hidden'
    body.style.overflow = 'hidden'

    return () => {
      documentElement.style.overflow = prevHtmlOverflow
      body.style.overflow = prevBodyOverflow
    }
  }, [isVisible])

  if (runPreload !== true) return null
  if (phase === 'done') return null

  const overlayTransition = {
    duration: phase === 'exiting' ? 0.98 : 0.68,
    ease,
  }

  return (
    <motion.div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-[100] overflow-hidden bg-black"
      initial={{ y: '100%', opacity: 1 }}
      animate={
        phase === 'exiting'
          ? { y: '-100%', opacity: 0 }
          : { y: '0%', opacity: 1 }
      }
      transition={overlayTransition}
      onAnimationComplete={() => {
        if (phaseRef.current === 'exiting') {
          setPhase('done')
          return
        }

        if (phaseRef.current === 'entering') {
          setPhase('playing')
        }
      }}
    >
      <motion.div
        className="pointer-events-none absolute inset-0"
        initial={{
          opacity: 0,
          scale: 0.9,
        }}
        animate={
          phase === 'exiting'
            ? { opacity: 1, scale: 1 }
            : { opacity: phase === 'playing' ? 1 : 0, scale: 1 }
        }
        transition={{
          duration: 0.22,
          ease,
        }}
      >
        <video
          ref={videoRef}
          src="/brand/logo-animation.mp4"
          muted
          playsInline
          preload="auto"
          controls={false}
          disablePictureInPicture
          className="pointer-events-none absolute inset-0 h-full w-full object-contain"
          onPlaying={() => {
            if ((videoRef.current?.currentTime ?? 0) > 0) {
              confirmPlayback()
            }
          }}
          onTimeUpdate={() => {
            if ((videoRef.current?.currentTime ?? 0) > 0) {
              confirmPlayback()
            }
          }}
          onEnded={() => {
            if (!holdSatisfiedRef.current) {
              endedBeforeHoldRef.current = true
              return
            }
            triggerExit()
          }}
          onError={() => {
            clearErrorExitTimer()
            errorExitTimerRef.current = window.setTimeout(() => {
              triggerExit()
            }, VIDEO_ERROR_EXIT_GRACE_MS)
          }}
        />
      </motion.div>
    </motion.div>
  )
}
