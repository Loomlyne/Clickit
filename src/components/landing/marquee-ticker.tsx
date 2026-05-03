'use client'

import { usePathname } from '@/i18n/navigation'

const MARQUEE_ITEMS = [
  { tag: 'NEW', text: 'Original shows · premiering now' },
  { tag: 'LIVE', text: 'Streaming from Abu Dhabi' },
  { tag: 'SHORT', text: 'Quick bites · 90-second cuts' },
  { tag: 'EST 2026', text: 'Clickit · Hand-picked, no algorithm' },
]

export function MarqueeTicker() {
  const pathname = usePathname()
  // Hide on landing so the full-screen hero video isn't broken by the dark ticker bar
  if (pathname === '/' || pathname === '') return null

  return (
    <div className="overflow-hidden border-y border-[var(--line)] bg-[var(--bg-0)] py-3">
      <div className="flex animate-[marqueeScroll_30s_linear_infinite] whitespace-nowrap">
        {[0, 1].map((dup) => (
          <span key={dup} className="flex items-center gap-10 pe-10">
            {MARQUEE_ITEMS.map((m, i) => (
              <span key={`${dup}-${i}`} className="flex items-center gap-3">
                <b className="mono text-[var(--primary)]">◆ {m.tag}</b>
                <span className="mono text-[var(--text-dim)]">{m.text}</span>
              </span>
            ))}
          </span>
        ))}
      </div>
      <style>{`
        @keyframes marqueeScroll {
          from { transform: translateX(0); }
          to { transform: translateX(-50%); }
        }
      `}</style>
    </div>
  )
}
