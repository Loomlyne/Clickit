'use client'

import Link from 'next/link'
import { motion } from 'motion/react'
import { MOCK_SHOWS } from '@/lib/mock-data'
import { SectionHeader } from '@/components/primitives/section-header'
import { ScrollReveal } from '@/components/primitives/scroll-reveal'

const GENRE_COLORS: Record<string, string> = {
  Entertainment: '#9F54A0',
  Documentary: '#2C3569',
  Health: '#50A258',
  Tech: '#2C3569',
  Kids: '#F8C623',
  Music: '#9F54A0',
  Comedy: '#EA8C2E',
  Cooking: '#DB3F34',
  Travel: '#50A258',
  Poetry: '#9F54A0',
  Cinema: '#DB3F34',
}

export function GenresGrid() {
  const genres = [...new Set(MOCK_SHOWS.map((s) => s.genre))]

  return (
    <ScrollReveal>
      <section>
        <SectionHeader title="Browse by Genre" />
        <div className="flex gap-3 overflow-x-auto px-6 md:px-12 pb-2 scrollbar-hide">
          {genres.map((genre) => {
            const color = GENRE_COLORS[genre] ?? '#2C3569'
            return (
              <Link
                key={genre}
                href={`/series?genre=${encodeURIComponent(genre)}`}
                className="group flex-shrink-0"
              >
                <motion.div
                  whileHover={{ scale: 1.05, y: -2 }}
                  transition={{ duration: 0.2 }}
                  className="flex items-center justify-center rounded-xl px-6 py-4 min-w-[140px] cursor-pointer transition-colors"
                  style={{
                    background: `${color}20`,
                    border: `1px solid ${color}40`,
                  }}
                >
                  <span
                    className="font-semibold text-sm whitespace-nowrap"
                    style={{ color }}
                  >
                    {genre}
                  </span>
                </motion.div>
              </Link>
            )
          })}
        </div>
      </section>
    </ScrollReveal>
  )
}
