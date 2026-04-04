import { ContentRail } from '@/components/home/content-rail'
import { getContinueWatching } from '@/lib/queries'

export async function ContinueWatchingRail() {
  const shows = await getContinueWatching()

  if (shows.length === 0) return null

  return <ContentRail title="Continue Watching" shows={shows} minCards={4} />
}
