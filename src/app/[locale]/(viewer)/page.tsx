import { LandingHero } from '@/components/landing/landing-hero'
import { MarqueeTicker } from '@/components/landing/marquee-ticker'
import { ShowsPortfolio } from '@/components/landing/shows-portfolio'
import { GenrePills } from '@/components/landing/genre-pills'
import { LandingFaq } from '@/components/landing/landing-faq'

export default async function LandingPage() {
  return (
    <div>
      <LandingHero />
      <MarqueeTicker />
      <ShowsPortfolio />
      <GenrePills />
      <LandingFaq />
    </div>
  )
}
