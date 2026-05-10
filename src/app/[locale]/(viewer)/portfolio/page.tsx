import { LandingHero } from '@/components/landing/landing-hero'
import { ShowsPortfolio } from '@/components/landing/shows-portfolio'
import { GenrePills } from '@/components/landing/genre-pills'
import { LandingFaq } from '@/components/landing/landing-faq'
import { EntryPreload } from '@/components/layout/entry-preload'

export default async function LandingPage() {
  return (
    <div>
      <EntryPreload />
      <LandingHero />
      <ShowsPortfolio />
      <GenrePills />
      <LandingFaq />
    </div>
  )
}
