import type { Metadata } from 'next'
import Link from 'next/link'
import { searchShows, searchEpisodes } from '@/lib/queries'
import { SearchResults } from '@/components/search/search-results'

export const metadata: Metadata = {
  title: 'Search | Clickit Story',
  description: 'Search shows and episodes on Clickit Story',
}

interface Props {
  searchParams: Promise<{ q?: string }>
}

export default async function SearchPage({ searchParams }: Props) {
  const { q } = await searchParams

  // Empty/no query state
  if (!q || q.trim().length === 0) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center px-6 text-center">
        <p className="mb-4 text-[11px] uppercase tracking-[0.28em] text-white/34">Search</p>
        <h1 className="font-display text-4xl font-semibold tracking-[-0.04em] text-white">
          Search Clickit Story
        </h1>
        <p className="mt-3 max-w-sm text-white/50">
          Find your favorite shows and episodes by title
        </p>
      </div>
    )
  }

  // Short query state
  if (q.trim().length < 2) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center px-6 text-center">
        <p className="text-white/50">Enter at least 2 characters to search</p>
      </div>
    )
  }

  // Fetch results in parallel
  const [shows, episodes] = await Promise.all([
    searchShows(q),
    searchEpisodes(q),
  ])

  // No results state
  if (shows.length === 0 && episodes.length === 0) {
    return (
      <div className="px-6 pb-16 pt-12 md:px-12">
        <p className="text-[11px] uppercase tracking-[0.28em] text-white/34">
          Results for
        </p>
        <h1 className="mt-2 font-display text-4xl font-semibold tracking-[-0.04em]">
          &ldquo;{q}&rdquo;
        </h1>
        <div className="mt-16 flex flex-col items-center text-center">
          <p className="text-white/50">No results found</p>
          <div className="mt-4 flex gap-3">
            <Link
              href="/search"
              className="text-sm text-white/60 underline hover:text-white"
            >
              Clear search
            </Link>
            <Link
              href="/"
              className="text-sm text-white/60 underline hover:text-white"
            >
              Browse all shows
            </Link>
          </div>
        </div>
      </div>
    )
  }

  // Results state
  return (
    <div className="px-6 pb-16 pt-12 md:px-12">
      <SearchResults query={q} shows={shows} episodes={episodes} />
    </div>
  )
}
