'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'

export function LandingFaq() {
  const t = useTranslations('landing')
  const FAQS = [
    { q: t('faq1Q'), a: t('faq1A') },
    { q: t('faq2Q'), a: t('faq2A') },
    { q: t('faq3Q'), a: t('faq3A') },
    { q: t('faq4Q'), a: t('faq4A') },
    { q: t('faq5Q'), a: t('faq5A') },
  ]
  const [openIdx, setOpenIdx] = useState(0)

  return (
    <section
      className="mx-auto max-w-[1400px] border-t border-[var(--line)] px-10 py-24"
      id="faq"
    >
      <h2 className="mb-12 font-[family-name:var(--font-display)] text-[clamp(36px,5vw,64px)] leading-none font-normal tracking-[-0.02em]">
        {t('faqHeading')}
      </h2>
      <div className="mx-auto max-w-[860px]">
        {FAQS.map((f, i) => (
          <div
            key={i}
            className="cursor-pointer border-t border-[var(--line)] py-7 last:border-b"
            onClick={() => setOpenIdx(openIdx === i ? -1 : i)}
          >
            <div className="flex items-center justify-between gap-6">
              <h3 className="flex-1 font-[family-name:var(--font-display)] text-[24px] font-normal tracking-[-0.01em]">
                {f.q}
              </h3>
              <div
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border transition-all duration-200 ${
                  openIdx === i
                    ? 'rotate-45 border-[var(--primary)] bg-[var(--primary)] text-[var(--primary-foreground)]'
                    : 'border-[var(--line-2)]'
                }`}
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                >
                  <path d="M12 5v14M5 12h14" />
                </svg>
              </div>
            </div>
            <div
              className="grid transition-[grid-template-rows] duration-300"
              style={{ gridTemplateRows: openIdx === i ? '1fr' : '0fr' }}
            >
              <div className="overflow-hidden">
                <p className="max-w-[640px] pt-4 text-[16px] leading-relaxed text-[var(--text-dim)]">
                  {f.a}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
