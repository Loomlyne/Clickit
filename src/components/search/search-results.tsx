import { getLocale, getTranslations } from 'next-intl/server'
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
  const [t, locale] = await Promise.all([getTranslations('search'), getLocale()])
  const isArabic = locale === 'ar'

  return (
    <>
      <p className="text-[11px] uppercase tracking-[0.28em] text-white/34">
        {isArabic ? 'نتائج البحث عن' : 'Results for'}
      </p>
      <h1 className="mt-2 font-display text-4xl font-semibold tracking-[-0.04em] md:text-5xl">
        &ldquo;{query}&rdquo;
      </h1>
      <p className="mt-3 text-sm text-white/50">
        {total} {isArabic ? (total === 1 ? 'نتيجة' : 'نتيجة') : (total === 1 ? 'result' : 'results')}
      </p>

      <div className="mt-10 space-y-12">
        {shows.length > 0 && (
          <section>
            <h2 className="mb-5 text-2xl font-semibold tracking-[-0.03em] text-white">{t('showsHeading')}</h2>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {shows.map((show) => (
                <PortraitShowCard key={show.id} show={show} />
              ))}
            </div>
          </section>
        )}

        {episodes.length > 0 && (
          <section>
            <h2 className="mb-5 text-2xl font-semibold tracking-[-0.03em] text-white">{t('episodesHeading')}</h2>
            <div className="space-y-3">
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
