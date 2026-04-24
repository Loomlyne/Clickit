// Browse page — matches handoff browse.jsx exactly
import { getLocale } from 'next-intl/server'
import { redirect } from '@/i18n/navigation'
import { HeroBanner } from '@/components/home/hero-banner'
import { ContentRail } from '@/components/home/content-rail'
import { ContinueWatchingRail } from '@/components/home/continue-watching-rail'
import { ShortsRail } from '@/components/browse/shorts-rail'
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

      <ContinueWatchingRail userId={userId} />

      <ShortsRail shows={shortsShows} />

      {streaming.length > 0 && (
        <ContentRail title="Now streaming" eyebrow="The full catalog" shows={streaming} />
      )}
      {comingSoon.length > 0 && (
        <ContentRail title="Coming soon" eyebrow="Teasers & release dates" shows={comingSoon} />
      )}

      {/* Bottom CTA — matches handoff inline section */}
      <section
        className="mx-10 my-[60px] rounded-[8px] border border-[var(--line)] p-20 text-center"
        style={{ background: 'linear-gradient(180deg, var(--bg-1), var(--bg-2))' }}
      >
        <div className="mono mb-3.5" style={{ color: 'var(--accent)', letterSpacing: '0.18em' }}>
          Upgrade · Annual plan
        </div>
        <h2
          className="font-display m-0 mb-3.5 font-normal"
          style={{ fontSize: 48, letterSpacing: '-0.02em' }}
        >
          Save 30% with a yearly plan.
        </h2>
        <p className="mx-auto mb-6 max-w-[520px] text-[var(--text-dim)]">
          Two months free, four profiles, 4K streaming, and early access to every new release.
        </p>
        <button className="rounded-[4px] bg-primary px-[26px] py-3.5 text-[15px] font-medium text-primary-foreground transition-[transform,background] duration-[120ms] hover:bg-white active:translate-y-px">
          Upgrade now
        </button>
      </section>
    </div>
  )
}
