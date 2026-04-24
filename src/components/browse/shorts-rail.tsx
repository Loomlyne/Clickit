// Shorts rail — matches handoff browse.jsx shorts section
'use client'

import { useState } from 'react'
import { ArrowRight } from 'lucide-react'
import type { ViewShow } from '@/lib/queries'

interface ShortsRailProps {
  shows: ViewShow[]
}

export function ShortsRail({ shows }: ShortsRailProps) {
  const [_selectedIdx, setSelectedIdx] = useState<number | null>(null)

  if (shows.length === 0) return null

  return (
    <section className="rail px-10 pb-3 pt-8">
      <div className="mb-4 flex items-baseline justify-between">
        <div>
          <div className="mono mb-1.5" style={{ color: 'var(--accent)' }}>Shorts · Connected to YouTube Shorts</div>
          <h2 className="font-display m-0 text-[26px]">Quick bites</h2>
        </div>
        <a className="mono flex items-center gap-1.5 cursor-pointer" href="#">
          View all <ArrowRight className="size-3" />
        </a>
      </div>

      <div className="flex gap-3 overflow-x-auto pb-3 scrollbar-hide">
        {shows.map((s, i) => (
          <div
            key={`short-${s.id}`}
            onClick={() => setSelectedIdx(i)}
            className="group relative shrink-0 cursor-pointer overflow-hidden rounded-[8px] bg-[var(--bg-2)]"
            style={{ width: 180, aspectRatio: '9/16' }}
          >
            {s.posterUrl ? (
              <img src={s.posterUrl} alt={s.title} className="h-full w-full object-cover" />
            ) : (
              <div className="h-full w-full bg-[var(--bg-2)]" />
            )}
            <div className="absolute inset-0 bg-gradient-to-b from-transparent from-[50%] to-[rgba(0,0,0,0.9)]" />
            {/* SHORT badge */}
            <div
              className="absolute left-2.5 top-2.5 rounded-[2px] px-1.5 py-[3px]"
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 9,
                letterSpacing: '0.14em',
                background: 'var(--accent)',
                color: 'var(--accent-fg)',
              }}
            >
              SHORT
            </div>
            {/* Play overlay on hover */}
            <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 transition-opacity duration-150 group-hover:opacity-100">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/95 text-[#0a0a0a]">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><polygon points="6 3 20 12 6 21 6 3" /></svg>
              </div>
            </div>
            {/* Bottom info */}
            <div className="absolute bottom-3 left-3 right-3">
              <div className="font-display mb-1 text-[16px] leading-[1.15]">{s.title}</div>
              <div className="mono" style={{ fontSize: 9 }}>{s.genre} · {Math.floor(200 + i * 137) % 900}K views</div>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
