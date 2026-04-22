'use client'

import { useState } from 'react'
import { useLocale } from 'next-intl'

import { Button } from '@/components/ui/button'
import { EpisodeRow } from '@/components/series/episode-row'
import type { ViewEpisode, ViewShow } from '@/lib/queries'

const CHUNK_SIZE = 20

interface EpisodeListProps {
  episodes: ViewEpisode[]
  showBrandColor: ViewShow['brandColor']
  currentEpisodeId?: string
  progressMap?: Record<string, { progressPercent: number; completed: boolean }>
}

export function EpisodeList({
  episodes,
  showBrandColor,
  currentEpisodeId,
  progressMap,
}: EpisodeListProps) {
  const [visibleCount, setVisibleCount] = useState(CHUNK_SIZE)
  const visibleEpisodes = episodes.slice(0, visibleCount)
  const hasMore = visibleCount < episodes.length
  const locale = useLocale()
  const isArabic = locale === 'ar'

  if (episodes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center px-4 py-16 text-center">
        <h3 className="text-xl font-bold text-foreground">{isArabic ? 'لا توجد حلقات بعد' : 'No Episodes Yet'}</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          {isArabic ? 'لم تُضف حلقات هذا الموسم بعد. عد قريباً.' : 'Episodes for this season haven\u2019t been added yet. Check back soon.'}
        </p>
      </div>
    )
  }

  return (
    <section aria-label={isArabic ? 'الحلقات' : 'Episodes'} className="px-4">
      <div className="space-y-3 md:space-y-4">
        {visibleEpisodes.map((ep) => {
          const progress = progressMap?.[ep.id]
          return (
            <EpisodeRow
              key={ep.id}
              episode={ep}
              showBrandColor={showBrandColor}
              currentEpisodeId={currentEpisodeId}
              resumePercent={progress?.progressPercent}
              isCompleted={progress?.completed}
            />
          )
        })}
      </div>

      {hasMore && (
        <Button
          variant="secondary"
          className="mt-6 mx-auto block"
          onClick={() => setVisibleCount((c) => c + CHUNK_SIZE)}
        >
          {isArabic ? 'عرض المزيد من الحلقات' : 'Load More Episodes'}
        </Button>
      )}
    </section>
  )
}
