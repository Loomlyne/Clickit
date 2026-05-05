import { LandingHero } from '@/components/landing/landing-hero'
import { MarqueeTicker } from '@/components/landing/marquee-ticker'
import { BrandStats } from '@/components/landing/brand-stats'
import { ShowsPortfolio } from '@/components/landing/shows-portfolio'
import { WhySection } from '@/components/landing/why-section'
import { GenrePills } from '@/components/landing/genre-pills'
import { LandingFaq } from '@/components/landing/landing-faq'
import { CtaBanner } from '@/components/home/cta-banner'
import { getAppConfig } from '@/lib/config'

export default async function LandingPage() {
  const { flags } = await getAppConfig()

  return (
    <div>
      <LandingHero />
      <MarqueeTicker />
      <BrandStats />
      <ShowsPortfolio />
      <WhySection />
      <GenrePills />
      {flags.showFaq && <LandingFaq />}
      <CtaBanner />
    </div>
  )
}
