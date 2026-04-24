import { getLocale } from 'next-intl/server'
import { redirect } from '@/i18n/navigation'
import { HeroBanner } from '@/components/home/hero-banner'
import { ContentRail } from '@/components/home/content-rail'
import { ContinueWatchingRail } from '@/components/home/continue-watching-rail'
import { NewEpisodesRail } from '@/components/home/new-episodes-rail'
import { ShortsRail } from '@/components/browse/shorts-rail'
import { CtaBanner } from '@/components/home/cta-banner'
import { createClient } from '@/lib/supabase/server'
import {
  getFeaturedShows,
  getStreamingShows,
  getComingSoonShows,
  getNewEpisodes,
  getFirstEpisodesForShows,
} from '@/lib/queries'
import { getIsMobile } from '@/lib/device'

export default async function BrowsePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const userId = user?.id ?? null

  const [featured, streaming, comingSoon, newEpisodes, isMobile, locale] = await Promise.all([
    getFeaturedShows(),
    getStreamingShows(),
    getComingSoonShows(),
    getNewEpisodes(),
    getIsMobile(),
    getLocale(),
  ])

  if (streaming.length === 0 && comingSoon.length === 0) {
    redirect({ href: '/', locale })
  }

  const firstEpisodeMap = await getFirstEpisodesForShows(featured.map(s => s.id))
  const featuredWithEpisodes = featured.map((show) => ({
    show,
    firstEpisodeId: firstEpisodeMap[show.id],
  }))

  // Shorts: placeholder data from new + streaming shows
  const shortsShows = [...newEpisodes.map(e => streaming.find(s => s.id === e.showId)).filter(Boolean), ...streaming].slice(0, 8) as typeof streaming

  return (
    <div>
      {featuredWithEpisodes.length > 0 && (
        <HeroBanner shows={featuredWithEpisodes} isMobile={isMobile} />
      )}

      <div className="mt-8 space-y-10 pb-20">
        <ContinueWatchingRail userId={userId} />

        <ShortsRail shows={shortsShows} />

        {streaming.length > 0 && (
          <ContentRail title="Now Streaming" shows={streaming} />
        )}
        {comingSoon.length > 0 && (
          <ContentRail title="Coming Soon" shows={comingSoon} />
        )}

        {/* Bottom CTA */}
        <section className="mx-10 rounded-lg border border-[var(--line)] bg-gradient-to-b from-[var(--bg-1)] to-[var(--bg-2)] p-20 text-center">
          <div className="mono mb-3.5 text-[var(--primary)]">Upgrade · Annual plan</div>
          <h2 className="font-[family-name:var(--font-display)] text-[48px] font-normal tracking-[-0.02em] mb-3.5">
            Save 30% with a yearly plan.
          </h2>
          <p className="text-[var(--text-dim)] max-w-[520px] mx-auto mb-6">
            Two months free, four profiles, 4K streaming, and early access to every new release.
          </p>
          <button className="rounded bg-[var(--primary)] px-6 py-3.5 text-[15px] font-medium text-[var(--primary-foreground)] transition-all hover:bg-white">
            Upgrade now
          </button>
        </section>
      </div>
    </div>
  )
}
