import { LandingHero } from '@/components/landing/landing-hero'
import { BrandStats } from '@/components/landing/brand-stats'
import { GenrePills } from '@/components/landing/genre-pills'
import { LandingFaq } from '@/components/landing/landing-faq'
import { CtaBanner } from '@/components/home/cta-banner'
import { getAppConfig } from '@/lib/config'
import { isEditorial } from '@/lib/design'
import {
  getFeaturedShows,
  getStreamingShows,
  getComingSoonShows,
  getDistinctGenres,
  getAllShows,
} from '@/lib/queries'
import { adaptShow } from '@/lib/editorial/adapter'
import { EditorialLanding } from '@/components/editorial/landing'
import { FAQ_ITEMS } from '@/lib/faq-data'

export default async function LandingPage() {
  const { flags, ...config } = await getAppConfig()

  if (isEditorial) {
    // Pull real data for the editorial landing. Parallel fetches, all cached.
    const [featured, allShows, comingSoon, genres] = await Promise.all([
      getFeaturedShows(),
      getAllShows(),
      getComingSoonShows(),
      getDistinctGenres(),
    ])

    const streamingView = allShows.filter((s) => s.status === 'streaming')

    const featuredEditorial = featured
      .map((s) => ({ ...adaptShow(s), featured: true }))
    const allEditorial = streamingView.map((s) => adaptShow(s))

    // Build genre tile data (typographic tiles, count per genre).
    const genreCounts: Record<string, number> = {}
    for (const s of allShows) {
      genreCounts[s.genre] = (genreCounts[s.genre] ?? 0) + 1
    }
    const genreTiles = genres.map((g) => ({ name: g, count: genreCounts[g] ?? 0 }))

    // FAQs from static source (admin can extend via appConfig later).
    const faqs = [...FAQ_ITEMS]

    // Stats — derive a few from the real catalog.
    const totalEpisodes = allShows.reduce((a, s) => a + s.episodeCount, 0)
    const stats = [
      { n: String(allShows.length), l: 'Original shows' },
      { n: String(totalEpisodes), l: 'Episodes streaming' },
      { n: String(comingSoon.length), l: 'Coming soon' },
      { n: '2', l: 'Languages (EN · AR)' },
    ]

    return (
      <EditorialLanding
        featuredShows={featuredEditorial}
        allShows={allEditorial}
        genres={genreTiles}
        faqs={faqs}
        stats={stats}
      />
    )
  }

  return (
    <div>
      <LandingHero />
      <div className="mt-28 space-y-28 pb-28">
        <BrandStats />
        <GenrePills />
        {flags.showFaq && <LandingFaq />}
      </div>
      <CtaBanner />
    </div>
  )
}
