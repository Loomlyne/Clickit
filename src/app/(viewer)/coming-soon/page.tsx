import Link from 'next/link'
import type { Metadata } from 'next'

import { Button } from '@/components/ui/button'
import { ComingSoonShowCard } from '@/components/shows/coming-soon-show-card'
import { EpisodeRow } from '@/components/series/episode-row'
import { SectionHeader } from '@/components/primitives/section-header'
import { ScrollReveal } from '@/components/primitives/scroll-reveal'
import {
  getComingSoonShows,
  getComingSoonEpisodes,
  type ViewShow,
} from '@/lib/queries'
import { BRAND_COLOR_HEX } from '@/lib/brand-colors'

export const metadata: Metadata = {
  title: 'Coming Soon | Clickit Story',
  description: 'Upcoming shows and new episodes coming to Clickit Story',
}

export default async function ComingSoonPage() {
  const [comingSoonShows, upcomingEpisodes] = await Promise.all([
    getComingSoonShows(),
    getComingSoonEpisodes(),
  ])

  // Group upcoming episodes by show for section 2 display
  const episodesByShow = upcomingEpisodes.reduce(
    (acc, ep) => {
      if (!acc[ep.showTitle]) {
        acc[ep.showTitle] = { brandColor: ep.showBrandColor, episodes: [] }
      }
      acc[ep.showTitle].episodes.push(ep)
      return acc
    },
    {} as Record<
      string,
      { brandColor: ViewShow['brandColor']; episodes: typeof upcomingEpisodes }
    >
  )

  return (
    <div className="pb-16">
      {/* Page header — anticipation design */}
      <div className="relative py-20 px-6 md:px-12 text-center overflow-hidden">
        {/* Subtle radial glow background */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              'radial-gradient(ellipse 60% 80% at 50% 100%, rgba(159,84,160,0.15), transparent)',
          }}
        />
        <div className="relative">
          <p
            className="text-sm tracking-[0.3em] uppercase mb-4"
            style={{ color: 'var(--color-brand-purple-safe)' }}
          >
            What&apos;s Next
          </p>
          <h1
            className="font-display font-bold text-white leading-tight"
            style={{ fontSize: 'clamp(2.5rem, 6vw, 4.5rem)' }}
          >
            What&apos;s Coming
          </h1>
          <p className="text-white/50 text-lg mt-3 max-w-md mx-auto">
            New shows and episodes on the way from CIT
          </p>
        </div>
      </div>

      {/* Section 1: Upcoming Shows */}
      {comingSoonShows.length > 0 ? (
        <section className="pb-12">
          <SectionHeader title="Upcoming Shows" />
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 px-6 md:px-12 mt-2">
            {comingSoonShows.map((show, i) => (
              <ScrollReveal key={show.id} delay={i * 0.06}>
                <ComingSoonShowCard show={show} />
              </ScrollReveal>
            ))}
          </div>
        </section>
      ) : (
        <section className="px-6 md:px-12 pb-12">
          <SectionHeader title="Upcoming Shows" />
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <h3 className="text-xl font-bold text-white">All Caught Up</h3>
            <p className="mt-2 text-sm text-white/50">
              No upcoming shows right now. Browse what&apos;s streaming.
            </p>
            <Link href="/" className="mt-4">
              <Button variant="default">Browse Shows</Button>
            </Link>
          </div>
        </section>
      )}

      {/* Section 2: New Episodes Dropping Soon */}
      {Object.keys(episodesByShow).length > 0 ? (
        <section className="px-6 md:px-12 pb-16">
          <SectionHeader title="New Episodes Dropping Soon" />
          <div className="mt-2 space-y-8">
            {Object.entries(episodesByShow).map(
              ([showTitle, { brandColor, episodes }]) => (
                <ScrollReveal key={showTitle}>
                  <div>
                    <h3 className="mb-3 text-sm font-medium text-white/60 flex items-center gap-2">
                      <div
                        className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                        style={{ background: BRAND_COLOR_HEX[brandColor] }}
                      />
                      {showTitle}
                    </h3>
                    <div className="space-y-2">
                      {episodes.map((ep) => (
                        <EpisodeRow
                          key={ep.id}
                          episode={ep}
                          showBrandColor={brandColor}
                        />
                      ))}
                    </div>
                  </div>
                </ScrollReveal>
              )
            )}
          </div>
        </section>
      ) : (
        <section className="px-6 md:px-12 pb-16">
          <SectionHeader title="New Episodes Dropping Soon" />
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <h3 className="text-xl font-bold text-white">
              No New Episodes Scheduled
            </h3>
            <p className="mt-2 text-sm text-white/50">
              Check back for upcoming episode releases.
            </p>
          </div>
        </section>
      )}
    </div>
  )
}
