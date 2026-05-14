'use client'

import { motion, useReducedMotion } from 'motion/react'
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react'

const ease = [0.22, 1, 0.36, 1] as const

const VIDEO_FALLBACK_EXIT_MS = 2400
const REDUCED_MOTION_EXIT_MS = 680
const VIDEO_ERROR_EXIT_GRACE_MS = 360

let hasShownPreloadThisDocument = false

export function EntryPreload() {
  const prefersReducedMotion = useReducedMotion()
  const [runPreload, setRunPreload] = useState<boolean | null>(null)
  const [phase, setPhase] = useState<'enter' | 'exit' | 'done'>('enter')
  const phaseRef = useRef(phase)
  phaseRef.current = phase
  const hasTriggeredExitRef = useRef(false)
  const hasPlaybackStartedRef = useRef(false)
  const fallbackTimerRef = useRef<number | null>(null)
  const errorExitTimerRef = useRef<number | null>(null)

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
    clearFallbackTimer()
    clearErrorExitTimer()
    setPhase('exit')
  }, [clearErrorExitTimer, clearFallbackTimer])

  const markPlaybackStarted = useCallback(() => {
    if (hasPlaybackStartedRef.current) return
    hasPlaybackStartedRef.current = true
    clearFallbackTimer()
    fallbackTimerRef.current = window.setTimeout(() => {
      triggerExit()
    }, VIDEO_FALLBACK_EXIT_MS)
  }, [clearFallbackTimer, triggerExit])

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
    if (!prefersReducedMotion) return
    const timer = window.setTimeout(() => {
      triggerExit()
    }, REDUCED_MOTION_EXIT_MS)
    return () => window.clearTimeout(timer)
  }, [prefersReducedMotion, runPreload, triggerExit])

  useEffect(() => {
    return () => {
      clearFallbackTimer()
      clearErrorExitTimer()
    }
  }, [clearErrorExitTimer, clearFallbackTimer])

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
    duration: prefersReducedMotion ? 0.32 : phase === 'exit' ? 0.98 : 0.68,
    ease,
  }

  return (
    <motion.div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-[100] overflow-hidden bg-black"
      initial={
        prefersReducedMotion ? { opacity: 1 } : { y: '100%', opacity: 1 }
      }
      animate={
        phase === 'exit'
          ? prefersReducedMotion
            ? { opacity: 0 }
            : { y: '-100%', opacity: 0 }
          : prefersReducedMotion
            ? { opacity: 1 }
            : { y: '0%', opacity: 1 }
      }
      transition={overlayTransition}
      onAnimationComplete={() => {
        if (phaseRef.current === 'exit') {
          setPhase('done')
        }
      }}
    >
      <motion.div
        className="pointer-events-none absolute inset-0"
        initial={{
          opacity: 0,
          scale: prefersReducedMotion ? 1 : 0.9,
        }}
        animate={
          phase === 'exit'
            ? {
                opacity: prefersReducedMotion ? 0 : 1,
                scale: prefersReducedMotion ? 1 : 1,
              }
            : { opacity: 1, scale: 1 }
        }
        transition={{
          duration: prefersReducedMotion ? 0.28 : 0.86,
          ease,
        }}
      >
        <video
          src="/brand/logo-animation.mp4"
          autoPlay
          muted
          playsInline
          preload="auto"
          controls={false}
          disablePictureInPicture
          className="pointer-events-none absolute inset-0 h-full w-full object-contain"
          onLoadedData={(event) => {
            markPlaybackStarted()
            event.currentTarget.play().catch(() => {
              // Browser may reject explicit play() while autoplay is already in flight.
              // Do not exit immediately, ended/error/fallback will drive lifecycle.
            })
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
