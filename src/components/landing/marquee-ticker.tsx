'use client'

import { usePathname } from '@/i18n/navigation'

import type { TopTickerConfig } from '@/lib/config'

type MarqueeTickerProps = {
  ticker: TopTickerConfig
}

export function MarqueeTicker({ ticker }: MarqueeTickerProps) {
  const pathname = usePathname()
  // Full-bleed landing / portfolio hero — keep ticker off so video isn’t clipped
  if (
    pathname === '/' ||
    pathname === '' ||
    pathname === '/portfolio' ||
    pathname.startsWith('/portfolio/')
  ) {
    return null
  }

  if (!ticker.enabled || ticker.items.length === 0) return null

  return (
    <div className="overflow-hidden border-y border-[var(--line)] bg-[var(--bg-0)] py-3">
      <div className="flex animate-[marqueeScroll_30s_linear_infinite] whitespace-nowrap">
        {[0, 1].map((dup) => (
          <span key={dup} className="flex items-center gap-10 pe-10">
            {ticker.items.map((m, i) => (
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
