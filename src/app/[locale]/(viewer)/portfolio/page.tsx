import { LandingHero } from '@/components/landing/landing-hero'
import { ShowsPortfolio } from '@/components/landing/shows-portfolio'
import { GenrePills } from '@/components/landing/genre-pills'
import { LandingFaq } from '@/components/landing/landing-faq'

export default async function LandingPage() {
  return (
    <div>
      <LandingHero />
      <ShowsPortfolio />
      <GenrePills />
      <LandingFaq />
    </div>
  )
}
