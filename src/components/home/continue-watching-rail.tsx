import { getContinueWatchingEpisodes } from '@/lib/queries'
import { SectionHeader } from '@/components/primitives/section-header'
import { ScrollReveal } from '@/components/primitives/scroll-reveal'
import { ContinueWatchingCard } from '@/components/home/continue-watching-card'

interface ContinueWatchingRailProps {
  userId: string | null
}

// Caller (browse page) passes userId from its own getUser() result so this
// component doesn't run a separate getUser() call. Middleware already validated
// the session once, and the browse page Server Component resolves the same
// user — this component just consumes the value.
export async function ContinueWatchingRail({ userId }: ContinueWatchingRailProps) {
  if (!userId) return null

  const items = await getContinueWatchingEpisodes(userId)

  if (items.length === 0) return null

  return (
    <ScrollReveal>
      <section className="overflow-hidden">
        <SectionHeader title="Continue Watching" />
        <div className="scrollbar-hide flex gap-4 overflow-x-auto px-6 pb-4 md:px-12">
          {items.map((item) => (
            <ContinueWatchingCard key={item.episodeId} item={item} />
          ))}
        </div>
      </section>
    </ScrollReveal>
  )
}
