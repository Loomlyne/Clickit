'use client'

import { ContentRail } from '@/components/home/content-rail'
import { MOCK_SHOWS } from '@/lib/mock-data'

// Shows the user has "in progress" — mapped to real Show objects for ShowCard rendering
const CONTINUE_WATCHING_SLUGS = ['last-call', 'doctor-care', 'saturn-podcast', 'review-documentary']

export function ContinueWatchingRail() {
  const shows = CONTINUE_WATCHING_SLUGS
    .map((slug) => MOCK_SHOWS.find((s) => s.slug === slug))
    .filter((s): s is typeof MOCK_SHOWS[number] => !!s)

  if (shows.length === 0) return null

  return <ContentRail title="Continue Watching" shows={shows} minCards={4} />
}
