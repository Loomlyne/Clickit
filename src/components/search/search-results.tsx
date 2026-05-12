import { getTranslations } from 'next-intl/server'
import { PortraitShowCard } from '@/components/shows/portrait-show-card'
import { EpisodeRow } from '@/components/series/episode-row'
import type { ViewShow, ViewEpisode } from '@/lib/queries'

interface SearchResultsProps {
  query: string
  shows: ViewShow[]
  episodes: (ViewEpisode & {
    showTitle: string
    showSlug: string
    showBrandColor: ViewShow['brandColor']
  })[]
}

export async function SearchResults({ query, shows, episodes }: SearchResultsProps) {
  const total = shows.length + episodes.length
  const t = await getTranslations('search')

  return (
    <>
      <p className="mono text-[var(--text-mute)]">
        {t('resultsSummary', { total, query })}
      </p>

      <div className="mt-10 space-y-12">
        {shows.length > 0 && (
          <section>
            <h2 className="font-display mb-5 text-[24px] font-normal text-[var(--text)]">
              {t('showsHeading')}
            </h2>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {shows.map((show) => (
                <PortraitShowCard key={show.id} show={show} />
              ))}
            </div>
          </section>
        )}

        {episodes.length > 0 && (
          <section>
            <h2 className="font-display mb-5 text-[24px] font-normal text-[var(--text)]">
              {t('episodesHeading')}
            </h2>
            <div className="space-y-2">
              {episodes.map((ep) => (
                <EpisodeRow
                  key={ep.id}
                  episode={ep}
                  showBrandColor={ep.showBrandColor}
                />
              ))}
            </div>
          </section>
        )}
      </div>
    </>
  )
}
