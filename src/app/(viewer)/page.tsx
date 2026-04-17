import { LandingHero } from '@/components/landing/landing-hero'
import { BrandStats } from '@/components/landing/brand-stats'
import { GenrePills } from '@/components/landing/genre-pills'
import { LandingFaq } from '@/components/landing/landing-faq'
import { CtaBanner } from '@/components/home/cta-banner'

export default function LandingPage() {
  return (
    <div>
      <LandingHero />
      <div className="mt-24 space-y-24 pb-20">
        <BrandStats />
        <GenrePills />
        <LandingFaq />
        <CtaBanner />
      </div>
    </div>
  )
}
