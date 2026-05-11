'use client'

import Image from 'next/image'
import { motion, useReducedMotion } from 'motion/react'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'

const ease = [0.22, 1, 0.36, 1] as const

const STORAGE_KEY = 'clickit-entry-preload-at'

const THREE_HOURS_MS = 3 * 60 * 60 * 1000

function isSameLocalCalendarDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

function shouldRunPreload(): boolean {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return true
    const lastTime = Number.parseInt(raw, 10)
    if (Number.isNaN(lastTime)) return true

    const now = Date.now()
    const last = new Date(lastTime)
    const today = new Date()
    const firstVisitOfLocalDay = !isSameLocalCalendarDay(last, today)
    const threeHoursPassed = now - lastTime >= THREE_HOURS_MS

    return firstVisitOfLocalDay || threeHoursPassed
  } catch {
    return true
  }
}

function recordPreloadCompleted() {
  try {
    localStorage.setItem(STORAGE_KEY, String(Date.now()))
  } catch {
    // ignore quota / private mode
  }
}

export function EntryPreload() {
  const prefersReducedMotion = useReducedMotion()
  const [runPreload, setRunPreload] = useState<boolean | null>(null)
  const [phase, setPhase] = useState<'enter' | 'exit' | 'done'>('enter')
  const phaseRef = useRef(phase)
  phaseRef.current = phase

  useLayoutEffect(() => {
    const run = shouldRunPreload()
    setRunPreload(run)
  }, [])

  useEffect(() => {
    if (runPreload !== true) return
    const exitDelay = prefersReducedMotion ? 680 : 1900
    const timer = window.setTimeout(() => {
      setPhase('exit')
    }, exitDelay)
    return () => window.clearTimeout(timer)
  }, [prefersReducedMotion, runPreload])

  useEffect(() => {
    if (runPreload !== true) return
  }, [phase, runPreload])

  if (runPreload !== true) return null
  if (phase === 'done') return null

  const overlayTransition = {
    duration: prefersReducedMotion ? 0.32 : phase === 'exit' ? 0.98 : 0.36,
    ease,
  }

  return (
    <motion.div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-[100] grid place-items-center overflow-hidden bg-black"
      initial={prefersReducedMotion ? { opacity: 1 } : { y: '0%', opacity: 1 }}
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
          recordPreloadCompleted()
          setPhase('done')
        }
      }}
    >
      <motion.div
        className="pointer-events-none relative h-28 w-72 sm:h-36 sm:w-96"
        initial={{
          opacity: 0,
          scale: prefersReducedMotion ? 1 : 0.9,
          y: prefersReducedMotion ? 0 : 80,
        }}
        animate={
          phase === 'exit'
            ? {
                opacity: prefersReducedMotion ? 0 : 1,
                scale: prefersReducedMotion ? 1 : 1,
                y: 0,
              }
            : { opacity: 1, scale: 1, y: 0 }
        }
        transition={{
          duration: prefersReducedMotion ? 0.28 : 0.86,
          ease,
        }}
      >
        <Image
          src="/brand/Clickit_final_logo.svg"
          alt=""
          fill
          priority
          sizes="(min-width: 640px) 384px, 288px"
          className="pointer-events-none object-contain"
        />
      </motion.div>
    </motion.div>
  )
}
