import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ScrollReveal } from '@/components/primitives/scroll-reveal'
import { getCatalogStage } from '@/lib/queries'

const CTA_COPY = {
  zero: {
    label: 'Coming soon',
    headline: 'Be there when CIT',
    headlineAccent: 'premieres.',
    body: 'Original series are arriving soon. Create your account now and be first to watch.',
    primaryLabel: 'Create Free Account',
    primaryHref: '/auth',
    secondaryLabel: "See what's coming",
    secondaryHref: '/coming-soon',
  },
  growing: {
    label: 'Now streaming',
    headline: 'The catalog has',
    headlineAccent: 'begun.',
    body: 'Watch the first stories on CIT and save your favorites for later.',
    primaryLabel: 'Start Watching',
    primaryHref: '/browse',
    secondaryLabel: "See what's coming",
    secondaryHref: '/coming-soon',
  },
  full: {
    label: 'Clickit membership',
    headline: 'Stream original programming with a',
    headlineAccent: 'calmer, premium experience.',
    body: 'Discover travel, health, music, comedy, cooking, and more from Abu Dhabi — crafted to let the stories lead.',
    primaryLabel: 'Start Watching Free',
    primaryHref: '/auth',
    secondaryLabel: "Explore what's next",
    secondaryHref: '/coming-soon',
  },
} as const

export async function CtaBanner() {
  const { stage } = await getCatalogStage()
  const copy = CTA_COPY[stage]

  return (
    <ScrollReveal>
      <div className="px-4 md:px-12">
        <div
          className="group relative overflow-hidden p-10 text-center md:p-24"
          style={{
            background: 'rgba(15,17,21,0.4)',
            backdropFilter: 'blur(24px)',
            border: '1px solid rgba(255,255,255,0.05)',
          }}
        >
          <div className="relative z-10 mx-auto flex max-w-3xl flex-col items-center">
            <span className="mb-6 text-[10px] font-semibold uppercase tracking-[0.2em] text-primary">
              {copy.label}
            </span>
            <h2
              className="font-display mb-8 font-medium tracking-tighter text-white"
              style={{
                fontSize: 'clamp(1.8rem, 5vw, 3.5rem)',
                lineHeight: 1.1,
                textWrap: 'balance',
              }}
            >
              {copy.headline}{' '}
              <span className="bg-gradient-to-r from-white to-white/40 bg-clip-text text-transparent">
                {copy.headlineAccent}
              </span>
            </h2>
            <p
              className="mx-auto mb-12 max-w-xl text-base font-light leading-relaxed text-white/40"
              style={{ textWrap: 'balance' }}
            >
              {copy.body}
            </p>
            <div className="flex flex-col items-center gap-4 sm:flex-row">
              <Button
                size="lg"
                className="rounded-full px-8 py-4 text-sm font-medium transition-all hover:-translate-y-0.5"
                asChild
              >
                <Link href={copy.primaryHref}>
                  {copy.primaryLabel}
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="ml-2"
                    aria-hidden="true"
                  >
                    <path d="M5 12h14M12 5l7 7-7 7" />
                  </svg>
                </Link>
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="rounded-full border-[#1A1C23] bg-transparent px-8 py-4 text-sm font-medium transition-all hover:-translate-y-0.5 hover:border-white/30 hover:bg-[#0F1115]"
                asChild
              >
                <Link href={copy.secondaryHref}>{copy.secondaryLabel}</Link>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </ScrollReveal>
  )
}
