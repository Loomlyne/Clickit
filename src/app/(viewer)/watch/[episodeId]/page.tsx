import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { Button } from '@/components/ui/button'
import { WatchPageContent } from '@/components/watch/watch-page-content'
import {
  MOCK_EPISODES,
  getEpisodeById,
  getEpisodeNavigation,
} from '@/lib/mock-data'

interface Props {
  params: Promise<{ episodeId: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { episodeId } = await params
  const data = getEpisodeById(episodeId)
  if (!data) return { title: 'Episode Not Found | Clickit Story' }
  return {
    title: `${data.episode.title} | ${data.show.title} | Clickit Story`,
    description: data.episode.description,
  }
}

export function generateStaticParams() {
  return MOCK_EPISODES.filter((ep) => ep.status === 'published').map((ep) => ({
    episodeId: ep.id,
  }))
}

export default async function WatchPage({ params }: Props) {
  const { episodeId } = await params

  // Check if episode exists at all
  const rawEpisode = MOCK_EPISODES.find((e) => e.id === episodeId)

  if (!rawEpisode) {
    notFound()
  }

  // Episode exists but is not published
  if (rawEpisode.status !== 'published') {
    const data = getEpisodeById(episodeId)
    const showTitle = data?.show.title ?? 'this show'
    const showSlug = data?.show.slug ?? ''

    return (
      <div className="flex flex-col items-center justify-center py-24 text-center px-6">
        <h1 className="text-4xl font-bold text-foreground">
          Episode Not Available
        </h1>
        <p className="mt-4 max-w-md text-muted-foreground">
          This episode isn&apos;t available for watching yet. Check back soon.
        </p>
        {showSlug && (
          <Button variant="default" className="mt-8" asChild>
            <Link href={`/series/${showSlug}`}>Back to {showTitle}</Link>
          </Button>
        )}
      </div>
    )
  }

  // Episode is published -- resolve full context
  const data = getEpisodeById(episodeId)
  if (!data) notFound()

  const { prev, next } = getEpisodeNavigation(
    episodeId,
    data.seasons,
    data.episodesBySeason
  )

  return (
    <WatchPageContent
      episode={data.episode}
      show={data.show}
      season={data.season}
      seasons={data.seasons}
      episodesBySeason={data.episodesBySeason}
      prevEpisode={prev}
      nextEpisode={next}
    />
  )
}
