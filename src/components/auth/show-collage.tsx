'use client'

import { motion } from 'motion/react'

import { ShowArt } from '@/components/primitives/show-art'
import { type Show, brandColorHexMap } from '@/lib/mock-data'

interface ShowCollageProps {
  shows: Show[]
}

export function ShowCollage({ shows }: ShowCollageProps) {
  const col1 = shows.slice(0, 4)
  const col2 = shows.slice(4, 8)

  return (
    <div
      className="absolute inset-0 flex items-center justify-center overflow-hidden"
      style={{ perspective: '800px' }}
    >
      <motion.div
        className="flex gap-4"
        style={{
          transform: 'rotateY(-8deg) rotateX(5deg)',
          transformOrigin: 'center center',
        }}
        animate={{ y: [0, -40] }}
        transition={{
          duration: 20,
          repeat: Infinity,
          repeatType: 'reverse',
          ease: 'linear',
        }}
      >
        {/* Column 1 */}
        <div className="flex flex-col gap-4">
          {col1.map((show) => (
            <div
              key={show.id}
              className="w-36 rounded-xl overflow-hidden flex-shrink-0"
              style={{ opacity: 0.8 }}
            >
              <ShowArt
                brandColor={brandColorHexMap[show.brandColor]}
                title={show.title}
                aspectRatio="2/3"
              >
                <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/80 to-transparent">
                  <p className="text-white text-xs font-medium truncate">{show.title}</p>
                </div>
              </ShowArt>
            </div>
          ))}
        </div>

        {/* Column 2 — offset down */}
        <div className="flex flex-col gap-4 mt-12">
          {col2.map((show) => (
            <div
              key={show.id}
              className="w-36 rounded-xl overflow-hidden flex-shrink-0"
              style={{ opacity: 0.7 }}
            >
              <ShowArt
                brandColor={brandColorHexMap[show.brandColor]}
                title={show.title}
                aspectRatio="2/3"
              >
                <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/80 to-transparent">
                  <p className="text-white text-xs font-medium truncate">{show.title}</p>
                </div>
              </ShowArt>
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  )
}
