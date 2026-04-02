'use client'

import Link from 'next/link'
import { motion } from 'motion/react'
import { Play } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { type Show, brandColorBgMap } from '@/lib/mock-data'

interface PortraitShowCardProps {
  show: Show
}

export function PortraitShowCard({ show }: PortraitShowCardProps) {
  return (
    <Link href={`/series/${show.slug}`} className="block">
      <motion.div
        whileHover={{ scale: 1.03 }}
        transition={{ duration: 0.25, ease: 'easeOut' }}
        className="group relative cursor-pointer overflow-hidden rounded-lg"
      >
        <div className={cn('relative aspect-[2/3]', brandColorBgMap[show.brandColor])}>
          <div className="pointer-events-none absolute inset-0 flex select-none items-center justify-center">
            <span className="text-[10vw] font-black leading-none text-white/10 lg:text-6xl">
              {show.title.split(' ')[0]}
            </span>
          </div>

          {/* Hover overlay */}
          <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-black/60">
              <Play className="size-5 fill-white text-white" />
            </div>
          </div>

          {/* Bottom gradient + info */}
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-4">
            <h3 className="truncate text-base font-bold text-white">{show.title}</h3>
            <div className="mt-1 flex items-center gap-2">
              <Badge variant="secondary" className="text-xs">{show.genre}</Badge>
              {show.viewCount && (
                <span className="text-xs text-white/60">{(show.viewCount / 1000).toFixed(1)}k views</span>
              )}
            </div>
          </div>
        </div>
      </motion.div>
    </Link>
  )
}
