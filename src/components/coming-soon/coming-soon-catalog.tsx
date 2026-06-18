import Image from 'next/image'
import { Link } from '@/i18n/navigation'
import { getTranslations } from 'next-intl/server'

import { Button } from '@/components/ui/button'
import { EpisodeRow } from '@/components/series/episode-row'
import {
  getComingSoonShows,
  getComingSoonEpisodes,
  type ViewShow,
} from '@/lib/queries'
import { BRAND_COLOR_HEX } from '@/lib/brand-colors'
import type { Locale } from '@/lib/locale'

export async function ComingSoonCatalog({ locale }: { locale: Locale }) {
  const [t, tCommon, comingSoonShows, upcomingEpisodes] = await Promise.all([
    getTranslations('comingSoon'),
    getTranslations('common'),
    getComingSoonShows(locale),
    getComingSoonEpisodes(locale),
  ])

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
      <div className="px-6 pt-16 pb-12 md:px-12">
        <div className="mx-auto max-w-4xl">
          <p className="mono mb-4 text-[var(--text-mute)]">
            {t('eyebrowYear')}
          </p>
          <h1 className="font-display text-[clamp(2.5rem,6vw,64px)] leading-[1.05] font-normal tracking-[-0.02em] text-[var(--text)]">
            {t('releasingHeading')}
          </h1>
          <p className="mt-4 max-w-lg text-[var(--text-dim)]">
            {t('description')}
          </p>
        </div>
      </div>

      {comingSoonShows.length > 0 ? (
        <section className="mx-auto max-w-4xl px-6 pb-16 md:px-12">
          <div className="space-y-0">
            {comingSoonShows.map((show) => {
              const thumbnail = show.heroImageUrl || show.posterUrl

              return (
                <div
                  key={show.id}
                  className="grid grid-cols-1 gap-6 border-t border-[var(--line)] py-8 md:grid-cols-[320px_1fr_auto] md:gap-10"
                >
                  <div className="w-full overflow-hidden rounded-[10px] bg-[var(--bg-2)] md:w-[320px]">
                    {thumbnail ? (
                      <Image
                        src={thumbnail}
                        alt={show.title}
                        width={320}
                        height={180}
                        sizes="320px"
                        className="aspect-video w-full object-cover"
                      />
                    ) : (
                      <div className="aspect-video w-full bg-[var(--bg-2)]" />
                    )}
                  </div>

                  <div className="flex flex-col justify-center gap-2">
                    <p
                      className="mono text-[12px]"
                      style={{ color: BRAND_COLOR_HEX[show.brandColor] }}
                    >
                      {show.tagline || show.genre}
                    </p>
                    <h2 className="font-display text-[clamp(1.5rem,4vw,44px)] leading-[1.1] font-normal tracking-[-0.02em] text-[var(--text)]">
                      {show.title}
                    </h2>
                    <p className="line-clamp-2 text-[14px] leading-relaxed text-[var(--text-dim)]">
                      {show.description}
                    </p>
                    <p className="mono mt-1 text-[11px] text-[var(--text-mute)]">
                      {show.genre} &middot; {show.seasonCount}{' '}
                      {show.seasonCount === 1
                        ? t('seasonOne')
                        : t('seasonMany')}
                    </p>
                  </div>

                  <div className="flex items-center">
                    <Link
                      href={`/updates?show=${encodeURIComponent(show.slug)}`}
                      className="mono rounded-full border border-[var(--line-2)] bg-transparent px-5 py-2.5 text-[12px] text-[var(--text-dim)] transition-colors hover:border-[var(--accent-yellow)] hover:text-[var(--text)]"
                    >
                      {t('remindMe')}
                    </Link>
                  </div>
                </div>
              )
            })}
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
            <Link href="/watch" className="mt-6 inline-block">
              <Button
                variant="outline"
                className="mono rounded-full border-[var(--line-2)] text-[12px]"
              >
                {tCommon('browseShows')}
              </Button>
            </Link>
          </div>
        </section>
      )}

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
