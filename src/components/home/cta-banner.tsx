import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ScrollReveal } from '@/components/primitives/scroll-reveal'

const BRAND_COLORS = ['#2C3569', '#9F54A0', '#50A258', '#DB3F34', '#EA8C2E', '#F8C623']

export function CtaBanner() {
  return (
    <ScrollReveal>
      <div className="px-6 md:px-12">
        <div className="relative overflow-hidden rounded-[32px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02))] px-6 py-16 shadow-[0_32px_90px_rgba(0,0,0,0.28)] md:px-10 md:py-20">
          <div className="absolute left-10 top-8 flex h-1 w-40 overflow-hidden rounded-full" aria-hidden="true">
            {BRAND_COLORS.map((color) => (
              <div key={color} className="flex-1" style={{ background: color }} />
            ))}
          </div>

          <div
            className="absolute inset-0"
            aria-hidden="true"
            style={{
              background: 'radial-gradient(circle at top center, rgba(96,115,255,0.24), transparent 38%)',
            }}
          />

          <div className="relative mx-auto max-w-3xl text-center">
            <p className="mb-4 text-[11px] font-medium uppercase tracking-[0.28em] text-white/38">
              Clickit membership
            </p>
            <h2
              className="font-display mb-4 font-semibold leading-[0.96] text-white"
              style={{ fontSize: 'clamp(2.4rem, 5vw, 4.4rem)' }}
            >
              Stream original programming with a calmer, premium viewing experience.
            </h2>
            <p className="mx-auto mb-8 max-w-2xl text-base leading-7 text-white/58 md:text-lg">
              Discover travel, health, music, comedy, cooking, and more from Abu Dhabi in a product shell built to let the stories lead.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <Button size="lg" className="px-8" asChild>
                <Link href="/auth">Start Watching Free</Link>
              </Button>
              <Button size="lg" variant="outline" className="px-8" asChild>
                <Link href="/coming-soon">Explore what’s next</Link>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </ScrollReveal>
  )
}
