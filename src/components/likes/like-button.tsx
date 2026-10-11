'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { motion, AnimatePresence } from 'motion/react'
import { Heart } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useLikes } from '@/hooks/use-likes'

const PARTICLE_COUNT = 6

// Pre-compute evenly-spaced angles for burst particles
const PARTICLES = Array.from({ length: PARTICLE_COUNT }, (_, i) => {
  const angle = (360 / PARTICLE_COUNT) * i + Math.random() * 20 - 10
  const rad = (angle * Math.PI) / 180
  const distance = 18 + Math.random() * 8
  return { x: Math.cos(rad) * distance, y: Math.sin(rad) * distance, angle }
})

const PARTICLE_COLORS = [
  '#ff6b8a',
  '#ff8fa3',
  '#ffb3c1',
  '#ff477e',
  '#e05297',
  '#ff85a1',
]

interface LikeButtonProps {
  showId: string
  initialLiked?: boolean
  userId: string | null
}

export function LikeButton({
  showId,
  initialLiked = false,
  userId,
}: LikeButtonProps) {
  const { isLiked, toggle } = useLikes(showId, initialLiked, userId)
  const [justLiked, setJustLiked] = useState(false)
  const t = useTranslations('show')

  const handleClick = () => {
    if (!isLiked) setJustLiked(true)
    toggle()
  }

  return (
    <motion.button
      onClick={handleClick}
      whileHover={{ scale: 1.08 }}
      whileTap={{ scale: 0.9 }}
      aria-label={isLiked ? t('unlike') : t('like')}
      className={cn(
        'relative flex h-11 w-11 items-center justify-center rounded-full border backdrop-blur-sm transition-all duration-300',
        isLiked
          ? 'border-pink-500/50 bg-pink-500/20 text-pink-400 hover:bg-pink-500/30'
          : 'border-white/25 bg-white/5 text-white/70 hover:bg-white/10 hover:text-white'
      )}
    >
      {/* Ring pulse on like */}
      <AnimatePresence>
        {isLiked && justLiked && (
          <motion.span
            key="ring"
            className="absolute inset-0 rounded-full border-2 border-pink-400/60"
            initial={{ scale: 1, opacity: 0.8 }}
            animate={{ scale: 1.8, opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
            onAnimationComplete={() => {
              setJustLiked(false)
            }}
          />
        )}
      </AnimatePresence>

      {/* Particle burst */}
      <AnimatePresence>
        {isLiked && justLiked && (
          <>
            {PARTICLES.map((p, i) => (
              <motion.span
                key={`p-${i}`}
                className="absolute top-1/2 left-1/2 h-1.5 w-1.5 rounded-full"
                style={{
                  backgroundColor: PARTICLE_COLORS[i % PARTICLE_COLORS.length],
                }}
                initial={{ x: '-50%', y: '-50%', scale: 1, opacity: 1 }}
                animate={{
                  x: p.x,
                  y: p.y,
                  scale: 0,
                  opacity: 0,
                }}
                transition={{ duration: 0.45, ease: 'easeOut', delay: 0.05 }}
              />
            ))}
          </>
        )}
      </AnimatePresence>

      {/* Heart icon with spring animation */}
      <motion.span
        key={isLiked ? 'liked' : 'not-liked'}
        initial={false}
        animate={
          isLiked
            ? { scale: [0.5, 1.3, 1], rotate: [0, -10, 10, 0] }
            : { scale: 1, rotate: 0 }
        }
        transition={
          isLiked
            ? { duration: 0.4, ease: [0.34, 1.56, 0.64, 1] }
            : { duration: 0.2 }
        }
        className="relative z-10 flex items-center justify-center"
      >
        <Heart
          className={cn(
            'h-5 w-5 transition-colors duration-300',
            isLiked && 'fill-pink-400 stroke-pink-400'
          )}
        />
      </motion.span>
    </motion.button>
  )
}
