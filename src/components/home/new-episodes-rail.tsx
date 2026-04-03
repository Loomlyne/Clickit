'use client'

import { ContentRail } from '@/components/home/content-rail'
import { getNewEpisodes, MOCK_SHOWS } from '@/lib/mock-data'

export function NewEpisodesRail() {
  const newEpisodes = getNewEpisodes()
  if (newEpisodes.length === 0) return null

  // Map episodes back to unique parent shows (preserving order of most recent episode)
  const seen = new Set<string>()
  const showsWithNewEpisodes = newEpisodes
    .map((ep) => MOCK_SHOWS.find((s) => s.slug === ep.showSlug))
    .filter((show): show is typeof MOCK_SHOWS[number] => {
      if (!show || seen.has(show.id)) return false
      seen.add(show.id)
      return true
    })

  if (showsWithNewEpisodes.length === 0) return null

  return <ContentRail title="New Episodes" shows={showsWithNewEpisodes} />
}
