import { createClient } from '@/lib/supabase/server'
import { getContinueWatchingEpisodes } from '@/lib/queries'
import { SectionHeader } from '@/components/primitives/section-header'
import { ScrollReveal } from '@/components/primitives/scroll-reveal'
import { ContinueWatchingCard } from '@/components/home/continue-watching-card'

export async function ContinueWatchingRail() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return null

  const items = await getContinueWatchingEpisodes(user.id)

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
