import type { Metadata } from 'next'

import { MOCK_SHOWS } from '@/lib/mock-data'
import { ShowCard } from '@/components/shows/show-card'

export const metadata: Metadata = {
  title: 'All Series | Clickit Story',
  description: 'Browse all original shows from Clickit Story',
}

export default function SeriesPage() {
  return (
    <div className="px-6 pt-12 pb-16 md:px-12">
      <h1 className="text-4xl font-bold text-primary lg:text-5xl">
        All Series
      </h1>

      {MOCK_SHOWS.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <h2 className="text-2xl font-bold text-primary">
            No Shows Available
          </h2>
          <p className="mt-4 max-w-md text-text-secondary">
            Our catalog is being built. Check back soon for original content
            from CIT.
          </p>
        </div>
      ) : (
        <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {MOCK_SHOWS.map((show) => (
            <ShowCard key={show.id} show={show} />
          ))}
        </div>
      )}
    </div>
  )
}
