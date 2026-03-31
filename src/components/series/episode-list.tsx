'use client'

import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { EpisodeRow } from '@/components/series/episode-row'
import type { Episode, Show } from '@/lib/mock-data'

const CHUNK_SIZE = 20

interface EpisodeListProps {
  episodes: Episode[]
  showBrandColor: Show['brandColor']
  currentEpisodeId?: string
}

export function EpisodeList({
  episodes,
  showBrandColor,
  currentEpisodeId,
}: EpisodeListProps) {
  const [visibleCount, setVisibleCount] = useState(CHUNK_SIZE)
  const visibleEpisodes = episodes.slice(0, visibleCount)
  const hasMore = visibleCount < episodes.length

  if (episodes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <h3 className="text-xl font-bold text-foreground">No Episodes Yet</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          Episodes for this season haven&apos;t been added yet. Check back soon.
        </p>
      </div>
    )
  }

  return (
    <section aria-label="Episodes">
      <div className="space-y-3 md:space-y-4">
        {visibleEpisodes.map((ep) => (
          <EpisodeRow
            key={ep.id}
            episode={ep}
            showBrandColor={showBrandColor}
            currentEpisodeId={currentEpisodeId}
          />
        ))}
      </div>

      {hasMore && (
        <Button
          variant="secondary"
          className="mt-6 mx-auto block"
          onClick={() => setVisibleCount((c) => c + CHUNK_SIZE)}
        >
          Load More Episodes
        </Button>
      )}
    </section>
  )
}
