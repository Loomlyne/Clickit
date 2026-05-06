'use client'

import Image from 'next/image'
import { motion, useReducedMotion } from 'motion/react'
import { useEffect, useState } from 'react'

const ease = [0.16, 1, 0.3, 1] as const

export function EntryPreload() {
  const prefersReducedMotion = useReducedMotion()
  const [phase, setPhase] = useState<'enter' | 'exit' | 'done'>('enter')

  useEffect(() => {
    const exitDelay = prefersReducedMotion ? 520 : 1500
    const timer = window.setTimeout(() => setPhase('exit'), exitDelay)

    return () => window.clearTimeout(timer)
  }, [prefersReducedMotion])

  if (phase === 'done') return null

  const overlayTransition = {
    duration: prefersReducedMotion ? 0.28 : phase === 'exit' ? 0.72 : 0.68,
    ease,
  }

  return (
    <motion.div
      aria-hidden="true"
      className="fixed inset-0 z-[100] grid place-items-center overflow-hidden bg-black"
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
        if (phase === 'exit') setPhase('done')
      }}
    >
      <motion.div
        className="relative h-20 w-52 sm:h-24 sm:w-64"
        initial={{
          opacity: 0,
          scale: prefersReducedMotion ? 1 : 0.92,
          y: prefersReducedMotion ? 0 : 18,
        }}
        animate={
          phase === 'exit'
            ? {
                opacity: 0,
                scale: prefersReducedMotion ? 1 : 0.98,
                y: prefersReducedMotion ? 0 : -36,
              }
            : { opacity: 1, scale: 1, y: 0 }
        }
        transition={{
          duration: prefersReducedMotion ? 0.24 : phase === 'exit' ? 0.42 : 0.5,
          delay: phase === 'enter' && !prefersReducedMotion ? 0.48 : 0,
          ease,
        }}
      >
        <Image
          src="/brand/Clickit_final_logo.svg"
          alt=""
          fill
          priority
          sizes="(min-width: 640px) 256px, 208px"
          className="object-contain"
        />
      </motion.div>
    </motion.div>
  )
}
