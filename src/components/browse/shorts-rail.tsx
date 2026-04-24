// Shorts rail — Quick Bites section on browse page
'use client'

import { useState } from 'react'
import { ArrowRight } from 'lucide-react'
import type { ViewShort } from '@/lib/queries'
import { ShortsOverlay } from '@/components/shorts/shorts-overlay'

interface ShortsRailProps {
  shorts: ViewShort[]
}

export function ShortsRail({ shorts }: ShortsRailProps) {
  const [overlayIdx, setOverlayIdx] = useState<number | null>(null)

  if (shorts.length === 0) return null

  return (
    <>
      <section className="rail px-10 pb-3 pt-8">
        <div className="mb-4 flex items-baseline justify-between">
          <div>
            <div className="mono mb-1.5" style={{ color: 'var(--accent)' }}>Shorts · Connected to YouTube Shorts</div>
            <h2 className="font-display m-0 text-[26px]">Quick bites</h2>
          </div>
          <button className="mono flex items-center gap-1.5 cursor-pointer hover:text-[var(--text)]">
            View all <ArrowRight className="size-3" />
          </button>
        </div>

        <div className="flex gap-3 overflow-x-auto pb-3 scrollbar-hide">
          {shorts.map((s, i) => (
            <div
              key={s.id}
              onClick={() => setOverlayIdx(i)}
              className="group relative shrink-0 cursor-pointer overflow-hidden rounded-[8px] bg-[var(--bg-2)]"
              style={{ width: 180, aspectRatio: '9/16' }}
            >
              {s.thumbnailUrl ? (
                <img src={s.thumbnailUrl} alt={s.title} className="h-full w-full object-cover" />
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
              {/* Bottom info */}
              <div className="absolute bottom-3 left-3 right-3">
                <div className="font-display mb-1 text-[16px] leading-[1.15]">{s.title}</div>
                <div className="mono" style={{ fontSize: 9 }}>
                  {s.channelName || s.genre || 'Short'}
                  {s.durationSeconds ? ` · ${s.durationSeconds}s` : ''}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {overlayIdx !== null && (
        <ShortsOverlay
          shorts={shorts}
          startIndex={overlayIdx}
          onClose={() => setOverlayIdx(null)}
        />
      )}
    </>
  )
}
