import { Suspense } from 'react'

import { LandingHero } from '@/components/landing/landing-hero'
import { ShowsPortfolio } from '@/components/landing/shows-portfolio'
import { GenrePills } from '@/components/landing/genre-pills'
import { LandingFaq } from '@/components/landing/landing-faq'
import {
  FaqSkeleton,
  HeroSkeleton,
  PillsSkeleton,
  PortfolioSkeleton,
} from '@/components/landing/portfolio-skeletons'

// Each section streams independently: the page shell + skeletons flush
// immediately, then each section's HTML streams in as its data resolves —
// instead of the whole page blocking on the slowest query. Fallbacks mirror
// loading.tsx so there's no layout shift.
export default function LandingPage() {
  return (
    <div>
      <Suspense fallback={<HeroSkeleton />}>
        <LandingHero />
      </Suspense>
      <Suspense fallback={<PortfolioSkeleton />}>
        <ShowsPortfolio />
      </Suspense>
      <Suspense fallback={<PillsSkeleton />}>
        <GenrePills />
      </Suspense>
      <Suspense fallback={<FaqSkeleton />}>
        <LandingFaq />
      </Suspense>
    </div>
  )
}
