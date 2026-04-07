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

export function SearchResults({ query, shows, episodes }: SearchResultsProps) {
  const total = shows.length + episodes.length

  return (
    <>
      <p className="text-[11px] uppercase tracking-[0.28em] text-white/34">
        Results for
      </p>
      <h1 className="mt-2 font-display text-4xl font-semibold tracking-[-0.04em] md:text-5xl">
        &ldquo;{query}&rdquo;
      </h1>
      <p className="mt-3 text-sm text-white/50">
        {total} {total === 1 ? 'result' : 'results'}
      </p>

      <div className="mt-10 space-y-12">
        {shows.length > 0 && (
          <section>
            <h2 className="mb-5 text-2xl font-semibold tracking-[-0.03em] text-white">Shows</h2>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {shows.map((show) => (
                <PortraitShowCard key={show.id} show={show} />
              ))}
            </div>
          </section>
        )}

        {episodes.length > 0 && (
          <section>
            <h2 className="mb-5 text-2xl font-semibold tracking-[-0.03em] text-white">Episodes</h2>
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
