‘use client’

import { useLocale } from ‘next-intl’
import { usePathname } from ‘@/i18n/navigation’

import type { TopTickerConfig } from ‘@/lib/config’

type MarqueeTickerProps = {
  ticker: TopTickerConfig
}

export function MarqueeTicker({ ticker }: MarqueeTickerProps) {
  const pathname = usePathname()
  const locale = useLocale()
  const isAr = locale === ‘ar’

  // Full-bleed landing / portfolio hero — keep ticker off so video isn’t clipped
  if (
    pathname === ‘/’ ||
    pathname === ‘’ ||
    pathname === ‘/portfolio’ ||
    pathname.startsWith(‘/portfolio/’)
  ) {
    return null
  }

  if (!ticker.enabled || ticker.items.length === 0) return null

  return (
    <div className="marquee-ticker overflow-hidden border-y border-[var(--line)] bg-[var(--bg-0)] py-3">
      <div className="marquee-track flex w-max whitespace-nowrap will-change-transform">
        {[0, 1].map((dup) => (
          <span
            key={dup}
            aria-hidden={dup === 1 ? ‘true’ : undefined}
            className="flex shrink-0 items-center gap-10 pe-10"
          >
            {ticker.items.map((m, i) => {
              const displayTag = isAr && m.tag_ar ? m.tag_ar : m.tag
              const displayText = isAr && m.text_ar ? m.text_ar : m.text
              const arFont =
                isAr && (m.tag_ar || m.text_ar)
                  ? ‘font-[family-name:var(--font-ge-ss)]’
                  : ‘mono’
              return (
                <span
                  key={`${dup}-${i}`}
                  className="flex items-center gap-3"
                  dir={isAr && (m.tag_ar || m.text_ar) ? ‘rtl’ : undefined}
                >
                  <b className={`${arFont} text-[var(--primary)]`}>◆ {displayTag}</b>
                  <span className={`${arFont} text-[var(--text-dim)]`}>{displayText}</span>
                </span>
              )
            })}
          </span>
        ))}
      </div>
      <style>{`
        .marquee-ticker .marquee-track {
          animation: cit-marquee 40s linear infinite;
          backface-visibility: hidden;
        }
        .marquee-ticker:hover .marquee-track {
          animation-play-state: paused;
        }
        @keyframes cit-marquee {
          0% { transform: translate3d(0, 0, 0); }
          100% { transform: translate3d(-50%, 0, 0); }
        }
        @media (prefers-reduced-motion: reduce) {
          .marquee-ticker .marquee-track { animation: none; }
        }
      `}</style>
    </div>
  )
}
