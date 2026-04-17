import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ScrollReveal } from '@/components/primitives/scroll-reveal'
import { getCatalogStage } from '@/lib/queries'

const BRAND_COLORS = ['#2C3569', '#9F54A0', '#50A258', '#DB3F34', '#EA8C2E', '#F8C623']

const CTA_COPY = {
  zero: {
    label: 'Coming soon',
    headline: 'Be there',
    headlineB: 'when CIT premieres.',
    body: 'Original series are arriving soon. Create your account now and be first to watch.',
    primaryLabel: 'Create Free Account',
    primaryHref: '/auth',
    secondaryLabel: "See what's coming →",
    secondaryHref: '/coming-soon',
  },
  growing: {
    label: 'Now streaming',
    headline: 'The catalog',
    headlineB: 'has begun.',
    body: 'Watch the first stories on CIT and save your favorites for later.',
    primaryLabel: 'Start Watching',
    primaryHref: '/browse',
    secondaryLabel: "See what's coming →",
    secondaryHref: '/coming-soon',
  },
  full: {
    label: 'Free · No subscription',
    headline: 'Original stories',
    headlineB: 'from Abu Dhabi.',
    body: 'Travel, health, music, comedy, cooking, and more — crafted to let the stories lead.',
    primaryLabel: 'Start Watching Free',
    primaryHref: '/browse',
    secondaryLabel: "What's coming next →",
    secondaryHref: '/coming-soon',
  },
} as const

export async function CtaBanner() {
  const { stage } = await getCatalogStage()
  const copy = CTA_COPY[stage]

  return (
    <ScrollReveal>
      {/* Full-bleed — no rounded card, no container padding */}
      <div className="relative overflow-hidden border-y border-white/[0.06]">
        {/* Background: deep dark with brand glow */}
        <div className="absolute inset-0 bg-[#07080d]" />
        <div
          className="pointer-events-none absolute inset-0"
          aria-hidden="true"
          style={{
            background:
              'radial-gradient(ellipse 70% 60% at 50% 100%, rgba(159,84,160,0.12) 0%, transparent 70%), radial-gradient(ellipse 50% 40% at 20% 0%, rgba(44,53,105,0.2) 0%, transparent 60%)',
          }}
        />

        {/* Brand color strip at top */}
        <div className="absolute inset-x-0 top-0 flex h-[2px]" aria-hidden="true">
          {BRAND_COLORS.map((color) => (
            <div key={color} className="flex-1" style={{ background: color }} />
          ))}
        </div>

        <div className="relative mx-auto max-w-5xl px-6 py-24 text-center md:px-12 md:py-32">
          <p className="mb-6 text-[11px] font-semibold uppercase tracking-[0.32em] text-white/32">
            {copy.label}
          </p>

          <h2
            className="font-display mx-auto mb-6 font-black text-white"
            style={{ fontSize: 'clamp(3rem, 8vw, 6.5rem)', lineHeight: 0.93, letterSpacing: '-0.05em', maxWidth: '14ch' }}
          >
            {copy.headline}{' '}
            <span className="text-white/28">{copy.headlineB}</span>
          </h2>

          <p className="mx-auto mb-12 max-w-xl text-base leading-7 text-white/48 md:text-lg">
            {copy.body}
          </p>

          <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <Button
              size="lg"
              className="w-full rounded-full px-10 py-6 text-base font-bold shadow-[0_0_60px_-10px_rgba(255,255,255,0.35)] sm:w-auto"
              asChild
            >
              <Link href={copy.primaryHref}>{copy.primaryLabel}</Link>
            </Button>
            <Link
              href={copy.secondaryHref}
              className="text-sm font-medium text-white/44 transition-colors hover:text-white/80"
            >
              {copy.secondaryLabel}
            </Link>
          </div>
        </div>

        {/* Brand color strip at bottom */}
        <div className="absolute inset-x-0 bottom-0 flex h-[2px]" aria-hidden="true">
          {BRAND_COLORS.map((color) => (
            <div key={color} className="flex-1" style={{ background: color }} />
          ))}
        </div>
      </div>
    </ScrollReveal>
  )
}
