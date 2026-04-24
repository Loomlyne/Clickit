'use client'

import { useState } from 'react'

const FAQS = [
  {
    q: 'What is Clickit?',
    a: 'Clickit is a curated streaming service for original shows produced in Abu Dhabi. Every show is hand-picked by our editors.',
  },
  {
    q: 'How much does it cost?',
    a: 'Clickit is free during open beta. No subscription required — just sign up and start watching.',
  },
  {
    q: 'Which devices are supported?',
    a: 'Any modern browser on desktop, tablet, or mobile. Our shows stream via YouTube for maximum compatibility.',
  },
  {
    q: 'Where does the content come from?',
    a: 'All content is original, produced by Spacelight Studios FZ LLC from Yas Creative Hub, Abu Dhabi.',
  },
  {
    q: 'Is there Arabic content?',
    a: 'Yes — all shows are bilingual (Arabic and English). The platform UI supports both languages.',
  },
  {
    q: 'How many shows are available?',
    a: 'We currently have 15 original programs spanning travel, health, music, comedy, cooking, kids, poetry, cinema, tech, and more.',
  },
]

export function LandingFaq() {
  const [openIdx, setOpenIdx] = useState(0)

  return (
    <section className="mx-auto max-w-[1400px] px-10 py-24 border-t border-[var(--line)]" id="faq">
      <div className="mono mb-3.5 text-[var(--text-mute)]">005 · FAQ</div>
      <h2 className="font-[family-name:var(--font-display)] text-[clamp(36px,5vw,64px)] font-normal leading-none tracking-[-0.02em] mb-12">
        Common questions.
      </h2>
      <div className="mx-auto max-w-[860px]">
        {FAQS.map((f, i) => (
          <div
            key={i}
            className="cursor-pointer border-t border-[var(--line)] py-7 last:border-b"
            onClick={() => setOpenIdx(openIdx === i ? -1 : i)}
          >
            <div className="flex items-center justify-between gap-6">
              <h3 className="font-[family-name:var(--font-display)] text-[24px] font-normal tracking-[-0.01em] flex-1">
                {f.q}
              </h3>
              <div
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border transition-all duration-200 ${
                  openIdx === i
                    ? 'bg-[var(--primary)] text-[var(--primary-foreground)] border-[var(--primary)] rotate-45'
                    : 'border-[var(--line-2)]'
                }`}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M12 5v14M5 12h14" />
                </svg>
              </div>
            </div>
            <div
              className="grid transition-[grid-template-rows] duration-300"
              style={{ gridTemplateRows: openIdx === i ? '1fr' : '0fr' }}
            >
              <div className="overflow-hidden">
                <p className="pt-4 text-[16px] leading-relaxed text-[var(--text-dim)] max-w-[640px]">
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
