import Image from 'next/image'
import { Link } from '@/i18n/navigation'
import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'

import { Button } from '@/components/ui/button'
import { EpisodeRow } from '@/components/series/episode-row'
import {
  getComingSoonShows,
  getComingSoonEpisodes,
  type ViewShow,
} from '@/lib/queries'
import { BRAND_COLOR_HEX } from '@/lib/brand-colors'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('comingSoon')
  return {
    title: `${t('pageTitle')} | Clickit Story`,
    description: t('description'),
  }
}

export default async function ComingSoonPage() {
  const [t, tCommon, comingSoonShows, upcomingEpisodes] = await Promise.all([
    getTranslations('comingSoon'),
    getTranslations('common'),
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
    <div className="pb-20">
      {/* Header */}
      <div className="px-6 pb-12 pt-16 md:px-12">
        <div className="mx-auto max-w-4xl">
          <p className="mono mb-4 text-[var(--text-mute)]">
            Coming soon &middot; 2026
          </p>
          <h1 className="font-display text-[clamp(2.5rem,6vw,64px)] font-normal leading-[1.05] tracking-[-0.02em] text-[var(--text)]">
            What we&rsquo;re releasing next.
          </h1>
          <p className="mt-4 max-w-lg text-[var(--text-dim)]">
            {t('description')}
          </p>
        </div>
      </div>

      {/* Section 1: Upcoming Shows — editorial list */}
      {comingSoonShows.length > 0 ? (
        <section className="mx-auto max-w-4xl px-6 pb-16 md:px-12">
          <div className="space-y-0">
            {comingSoonShows.map((show) => (
              (() => {
                const thumbnail = show.heroImageUrl || show.posterUrl

                return (
                  <div
                    key={show.id}
                    className="grid grid-cols-1 gap-6 border-t border-[var(--line)] py-8 md:grid-cols-[320px_1fr_auto] md:gap-10"
                  >
                    {/* Landscape thumbnail */}
                    <div className="w-full overflow-hidden rounded-[4px] bg-[var(--bg-2)] md:w-[320px]">
                      {thumbnail ? (
                        <Image
                          src={thumbnail}
                          alt={show.title}
                          width={320}
                          height={180}
                          className="aspect-video w-full object-cover"
                          unoptimized
                        />
                      ) : (
                        <div className="aspect-video w-full bg-[var(--bg-2)]" />
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex flex-col justify-center gap-2">
                      <p
                        className="mono text-[12px]"
                        style={{ color: BRAND_COLOR_HEX[show.brandColor] }}
                      >
                        {show.tagline || show.genre}
                      </p>
                      <h2 className="font-display text-[clamp(1.5rem,4vw,44px)] font-normal leading-[1.1] tracking-[-0.02em] text-[var(--text)]">
                        {show.title}
                      </h2>
                      <p className="line-clamp-2 text-[14px] leading-relaxed text-[var(--text-dim)]">
                        {show.description}
                      </p>
                      <p className="mono mt-1 text-[11px] text-[var(--text-mute)]">
                        {show.genre} &middot; {show.seasonCount}{' '}
                        {show.seasonCount === 1 ? 'season' : 'seasons'}
                      </p>
                    </div>

                    {/* Action */}
                    <div className="flex items-center">
                      <Link
                        href={`/updates?show=${encodeURIComponent(show.slug)}`}
                        className="mono rounded-[4px] border border-[var(--line-2)] bg-transparent px-5 py-2.5 text-[12px] text-[var(--text-dim)] transition-colors hover:border-[var(--accent-yellow)] hover:text-[var(--text)]"
                      >
                        Remind me
                      </Link>
                    </div>
                  </div>
                )
              })()
            ))}
          </div>
        </section>
      ) : (
        <section className="mx-auto max-w-4xl px-6 pb-16 md:px-12">
          <div className="border-t border-[var(--line)] py-16 text-center">
            <h3 className="font-display text-[24px] font-normal text-[var(--text)]">
              {t('noUpcomingHeading')}
            </h3>
            <p className="mt-2 text-[14px] text-[var(--text-dim)]">
              {t('noUpcomingDescription')}
            </p>
            <Link href="/" className="mt-6 inline-block">
              <Button
                variant="outline"
                className="mono rounded-[4px] border-[var(--line-2)] text-[12px]"
              >
                {tCommon('browseShows')}
              </Button>
            </Link>
          </div>
        </section>
      )}

      {/* Section 2: New Episodes Dropping Soon */}
      {Object.keys(episodesByShow).length > 0 ? (
        <section className="mx-auto max-w-4xl px-6 pb-16 md:px-12">
          <p className="mono mb-6 text-[var(--text-mute)]">
            {t('newEpisodesHeading')}
          </p>
          <div className="space-y-8">
            {Object.entries(episodesByShow).map(
              ([showTitle, { brandColor, episodes }]) => (
                <div key={showTitle}>
                  <h3 className="mono mb-3 flex items-center gap-2 text-[12px] text-[var(--text-dim)]">
                    <div
                      className="size-1.5 flex-shrink-0 rounded-full"
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
              )
            )}
          </div>
        </section>
      ) : (
        <section className="mx-auto max-w-4xl px-6 pb-16 md:px-12">
          <div className="border-t border-[var(--line)] py-16 text-center">
            <h3 className="font-display text-[24px] font-normal text-[var(--text)]">
              {t('noNewEpisodesHeading')}
            </h3>
            <p className="mt-2 text-[14px] text-[var(--text-dim)]">
              {t('noNewEpisodesDescription')}
            </p>
          </div>
        </section>
      )}
    </div>
  )
}
