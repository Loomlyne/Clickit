import { getTranslations } from 'next-intl/server'

export async function WhySection() {
  const t = await getTranslations('landing')

  const FEATURES = [
    { n: '01', h: t('why01Heading'), b: t('why01Body') },
    { n: '02', h: t('why02Heading'), b: t('why02Body') },
    { n: '03', h: t('why03Heading'), b: t('why03Body') },
  ]

  return (
    <section className="mx-auto max-w-[1400px] px-10 py-24 border-t border-[var(--line)]" id="features">
      <div className="grid grid-cols-1 items-start gap-20 md:grid-cols-2">
        <div>
          <div className="mono mb-3.5 text-[var(--text-mute)]">{t('whyEyebrow')}</div>
          <h2 className="font-[family-name:var(--font-display)] text-[clamp(36px,5vw,64px)] font-normal leading-none tracking-[-0.02em]">
            {t('whyHeading')}
          </h2>
        </div>
        <div className="flex flex-col gap-8">
          {FEATURES.map((f) => (
            <div
              key={f.n}
              className="grid grid-cols-[60px_1fr] gap-5 border-b border-[var(--line)] pb-8"
            >
              <div className="mono text-[13px] text-[var(--primary)]">{f.n}</div>
              <div>
                <h3 className="font-[family-name:var(--font-display)] text-[28px] font-normal tracking-[-0.01em] mb-2.5">
                  {f.h}
                </h3>
                <p className="text-[15px] leading-relaxed text-[var(--text-dim)]">{f.b}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
