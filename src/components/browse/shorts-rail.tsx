'use client'

import { useState } from 'react'
import type { ViewShow } from '@/lib/queries'

interface ShortsRailProps {
  shows: ViewShow[]
}

export function ShortsRail({ shows }: ShortsRailProps) {
  const [_selectedIdx, setSelectedIdx] = useState<number | null>(null)

  if (shows.length === 0) return null

  return (
    <section className="px-10">
      <div className="flex items-baseline justify-between mb-4">
        <div>
          <div className="mono mb-1.5 text-[var(--primary)]">Shorts · Connected to YouTube Shorts</div>
          <h2 className="font-[family-name:var(--font-display)] text-[26px] font-normal tracking-[-0.01em]">Quick bites</h2>
        </div>
        <span className="mono flex items-center gap-1.5 cursor-pointer">
          View all
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
        </span>
      </div>
      <div className="flex gap-3 overflow-x-auto pb-3 scrollbar-hide">
        {shows.map((s, i) => (
          <div
            key={`short-${s.id}`}
            onClick={() => setSelectedIdx(i)}
            className="group relative shrink-0 w-[180px] cursor-pointer overflow-hidden rounded-lg bg-[var(--bg-2)]"
            style={{ aspectRatio: '9/16' }}
          >
            {s.posterUrl ? (
              <img src={s.posterUrl} alt={s.title} className="h-full w-full object-cover" />
            ) : (
              <div className="h-full w-full bg-[var(--bg-2)]" />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent" />
            {/* SHORT badge */}
            <div className="absolute top-2.5 left-2.5 mono text-[9px] px-1.5 py-0.5 bg-[var(--primary)] text-[var(--primary-foreground)] rounded-sm">
              SHORT
            </div>
            {/* Play overlay on hover */}
            <div className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity duration-150 bg-black/30 group-hover:opacity-100">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/95 text-[#0a0a0a]">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><polygon points="6 3 20 12 6 21 6 3" /></svg>
              </div>
            </div>
            {/* Bottom info */}
            <div className="absolute bottom-3 left-3 right-3">
              <div className="font-[family-name:var(--font-display)] text-[16px] leading-tight mb-1">{s.title}</div>
              <div className="mono text-[9px]">{s.genre} · {Math.floor(200 + i * 137) % 900}K views</div>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
