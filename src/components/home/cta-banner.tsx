import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ScrollReveal } from '@/components/primitives/scroll-reveal'
import { getCatalogStage } from '@/lib/queries'

const BRAND_COLORS = ['#2C3569', '#9F54A0', '#50A258', '#DB3F34', '#EA8C2E', '#F8C623']

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
    headline: 'Stream original programming with a calmer,',
    headlineAccent: 'premium experience.',
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
      <div className="px-6 md:px-12">
        <div className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.03] px-6 py-16 shadow-[0_30px_60px_-12px_rgba(0,0,0,0.5)] backdrop-blur-2xl md:px-10 md:py-20">
          {/* Radial glow */}
          <div
            className="pointer-events-none absolute inset-0"
            aria-hidden="true"
            style={{
              background: 'radial-gradient(ellipse at bottom, rgba(96,115,255,0.15) 0%, transparent 70%)',
            }}
          />

          {/* Noise texture */}
          <div
            className="pointer-events-none absolute inset-0 opacity-30"
            aria-hidden="true"
            style={{
              backgroundImage:
                "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.04'/%3E%3C/svg%3E\")",
              backgroundRepeat: 'repeat',
              backgroundSize: '256px',
              mixBlendMode: 'overlay',
            }}
          />

          {/* Brand bar accent */}
          <div className="absolute left-10 top-8 flex h-1 w-40 overflow-hidden rounded-full" aria-hidden="true">
            {BRAND_COLORS.map((color) => (
              <div key={color} className="flex-1" style={{ background: color }} />
            ))}
          </div>

          <div className="relative mx-auto max-w-3xl text-center">
            <p className="mb-4 text-[11px] font-semibold uppercase tracking-[0.28em] text-white/40">
              {copy.label}
            </p>
            <h2
              className="font-display mb-5 font-black text-white"
              style={{ fontSize: 'clamp(2.2rem, 5vw, 4rem)', lineHeight: 0.96, letterSpacing: '-0.04em' }}
            >
              {copy.headline}{' '}
              <span className="text-white/30">{copy.headlineAccent}</span>
            </h2>
            <p className="mx-auto mb-10 max-w-2xl text-base leading-7 text-white/52 md:text-lg">
              {copy.body}
            </p>
            <div className="flex flex-wrap items-center justify-center gap-4">
              <Button
                size="lg"
                className="rounded-full px-8 py-5 text-base font-bold shadow-[0_0_40px_-10px_rgba(255,255,255,0.4)]"
                asChild
              >
                <Link href={copy.primaryHref}>{copy.primaryLabel}</Link>
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="rounded-full border-white/20 px-8 py-5 text-base font-medium hover:border-white/40 hover:bg-white/[0.05]"
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
