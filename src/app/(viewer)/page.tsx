import { LandingHero } from '@/components/landing/landing-hero'
import { BrandStats } from '@/components/landing/brand-stats'
import { GenrePills } from '@/components/landing/genre-pills'
import { CtaBanner } from '@/components/home/cta-banner'

export default function LandingPage() {
  return (
    <div>
      <LandingHero />
      <div className="space-y-0 pb-32">
        <BrandStats />
        <GenrePills />
        <CtaBanner />
      </div>
    </div>
  )
}
