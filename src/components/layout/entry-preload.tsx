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

const VIDEO_FALLBACK_EXIT_MS = 4200
const VIDEO_START_GRACE_MS = 2200
const VIDEO_ERROR_EXIT_GRACE_MS = 360

let hasShownPreloadThisDocument = false

export function EntryPreload() {
  const [runPreload, setRunPreload] = useState<boolean | null>(null)
  const [phase, setPhase] = useState<'enter' | 'play' | 'exit' | 'done'>(
    'enter'
  )
  const [isVideoReady, setIsVideoReady] = useState(false)
  const phaseRef = useRef(phase)
  phaseRef.current = phase
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const hasTriggeredExitRef = useRef(false)
  const hasPlaybackStartedRef = useRef(false)
  const fallbackTimerRef = useRef<number | null>(null)
  const startGraceTimerRef = useRef<number | null>(null)
  const errorExitTimerRef = useRef<number | null>(null)

  const clearStartGraceTimer = useCallback(() => {
    if (startGraceTimerRef.current === null) return
    window.clearTimeout(startGraceTimerRef.current)
    startGraceTimerRef.current = null
  }, [])

  const clearFallbackTimer = useCallback(() => {
    if (fallbackTimerRef.current === null) return
    window.clearTimeout(fallbackTimerRef.current)
    fallbackTimerRef.current = null
  }, [])

  const clearErrorExitTimer = useCallback(() => {
    if (errorExitTimerRef.current === null) return
    window.clearTimeout(errorExitTimerRef.current)
    errorExitTimerRef.current = null
  }, [])

  const triggerExit = useCallback(() => {
    if (hasTriggeredExitRef.current) return
    hasTriggeredExitRef.current = true
    clearStartGraceTimer()
    clearFallbackTimer()
    clearErrorExitTimer()
    setPhase('exit')
  }, [clearErrorExitTimer, clearFallbackTimer, clearStartGraceTimer])

  const markPlaybackStarted = useCallback(() => {
    if (hasPlaybackStartedRef.current) return
    hasPlaybackStartedRef.current = true
    clearStartGraceTimer()
    clearFallbackTimer()
    fallbackTimerRef.current = window.setTimeout(() => {
      triggerExit()
    }, VIDEO_FALLBACK_EXIT_MS)
  }, [clearFallbackTimer, clearStartGraceTimer, triggerExit])

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
    if (phase !== 'play') return
    if (!isVideoReady) return

    const video = videoRef.current
    if (!video) {
      triggerExit()
      return
    }

    hasPlaybackStartedRef.current = false
    clearStartGraceTimer()
    clearFallbackTimer()
    clearErrorExitTimer()

    video.muted = true
    video.controls = false
    video.currentTime = 0

    startGraceTimerRef.current = window.setTimeout(() => {
      if (!hasPlaybackStartedRef.current) triggerExit()
    }, VIDEO_START_GRACE_MS)

    video.play().catch(() => {
      clearStartGraceTimer()
      startGraceTimerRef.current = window.setTimeout(() => {
        if (!hasPlaybackStartedRef.current) triggerExit()
      }, VIDEO_START_GRACE_MS)
    })
  }, [
    phase,
    runPreload,
    clearErrorExitTimer,
    clearFallbackTimer,
    clearStartGraceTimer,
    isVideoReady,
    triggerExit,
  ])

  useEffect(() => {
    return () => {
      clearStartGraceTimer()
      clearFallbackTimer()
      clearErrorExitTimer()
    }
  }, [clearErrorExitTimer, clearFallbackTimer, clearStartGraceTimer])

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
    duration: phase === 'exit' ? 0.98 : 0.68,
    ease,
  }

  return (
    <motion.div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-[100] overflow-hidden bg-black"
      initial={{ y: '100%', opacity: 1 }}
      animate={
        phase === 'exit'
          ? { y: '-100%', opacity: 0 }
          : { y: '0%', opacity: 1 }
      }
      transition={overlayTransition}
      onAnimationComplete={() => {
        if (phaseRef.current === 'exit') {
          setPhase('done')
          return
        }

        if (phaseRef.current === 'enter') {
          setPhase('play')
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
          phase === 'exit'
            ? { opacity: 1, scale: 1 }
            : { opacity: phase === 'play' ? 1 : 0, scale: 1 }
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
          onLoadedData={() => {
            setIsVideoReady(true)
          }}
          onCanPlay={() => {
            setIsVideoReady(true)
          }}
          onPlaying={markPlaybackStarted}
          onEnded={triggerExit}
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
