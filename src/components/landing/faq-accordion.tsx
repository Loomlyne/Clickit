'use client'

import { useId, useState } from 'react'

export function FaqAccordion({ items }: { items: { q: string; a: string }[] }) {
  const [openIdx, setOpenIdx] = useState(0)
  const baseId = useId()

  return (
    <div className="mx-auto max-w-[860px]">
      {items.map((f, i) => {
        const isOpen = openIdx === i
        const qId = `${baseId}-q-${i}`
        const aId = `${baseId}-a-${i}`
        return (
          <div
            key={i}
            className="border-t border-[var(--line)] py-3 last:border-b"
          >
            <h3 className="font-[family-name:var(--font-display)] text-[16px] font-medium tracking-[-0.01em] md:text-[20px]">
              <button
                type="button"
                id={qId}
                aria-expanded={isOpen}
                aria-controls={aId}
                onClick={() => setOpenIdx(isOpen ? -1 : i)}
                className="flex min-h-14 w-full items-center justify-between gap-6 rounded-md text-start focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)]"
              >
                <span className="flex-1">{f.q}</span>
                <span
                  aria-hidden="true"
                  className={`flex size-11 shrink-0 items-center justify-center rounded-full border transition-colors duration-200 ${
                    isOpen
                      ? 'border-[var(--primary)] bg-[var(--primary)] text-[var(--primary-foreground)]'
                      : 'border-[var(--line-2)]'
                  }`}
                >
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  >
                    <path d={isOpen ? 'M5 12h14' : 'M12 5v14M5 12h14'} />
                  </svg>
                </span>
              </button>
            </h3>
            <div
              id={aId}
              role={items.length <= 6 ? 'region' : undefined}
              aria-labelledby={qId}
              inert={!isOpen}
              className="grid transition-[grid-template-rows] duration-300"
              style={{ gridTemplateRows: isOpen ? '1fr' : '0fr' }}
            >
              <div className="overflow-hidden">
                <p className="max-w-[640px] pt-4 text-[14px] leading-relaxed text-[var(--text-dim)] md:text-[16px]">
                  {f.a}
                </p>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
