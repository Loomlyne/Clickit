import { LandingHero } from '@/components/landing/landing-hero'
import { ShowsPortfolio } from '@/components/landing/shows-portfolio'
import { BrandStats } from '@/components/landing/brand-stats'
import { GenrePills } from '@/components/landing/genre-pills'
import { CtaBanner } from '@/components/home/cta-banner'

export default function LandingPage() {
  return (
    <div>
      <LandingHero />
      <div className="mt-24 space-y-20 pb-20">
        <ShowsPortfolio />
        <BrandStats />
        <GenrePills />
        <CtaBanner />
      </div>
    </div>
  )
}
