import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getWatchlistShows } from '@/lib/queries'
import { PortraitShowCard } from '@/components/shows/portrait-show-card'
import { SectionHeader } from '@/components/primitives/section-header'
import { ScrollReveal } from '@/components/primitives/scroll-reveal'

export const metadata: Metadata = {
  title: 'My List | Clickit Story',
  description: 'Your saved shows on Clickit Story',
}

export default async function MyListPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/auth?next=/my-list')

  const shows = await getWatchlistShows(user.id)

  return (
    <div className="pb-16">
      {/* Page header */}
      <div className="relative py-20 px-6 md:px-12 text-center overflow-hidden">
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              'radial-gradient(ellipse 60% 80% at 50% 100%, rgba(44,53,105,0.15), transparent)',
          }}
        />
        <div className="relative">
          <p
            className="text-sm tracking-[0.3em] uppercase mb-4"
            style={{ color: 'var(--color-brand-blue-safe)' }}
          >
            My List
          </p>
          <h1 className="font-display font-bold text-3xl sm:text-4xl md:text-5xl text-white leading-tight">
            Saved Shows
          </h1>
          <p className="text-white/50 text-lg mt-3 max-w-md mx-auto">
            {shows.length > 0
              ? `${shows.length} show${shows.length !== 1 ? 's' : ''} in your list`
              : 'Save shows to watch them later.'}
          </p>
        </div>
      </div>

      {/* Show grid or empty state */}
      {shows.length > 0 ? (
        <div className="px-6 md:px-12">
          <SectionHeader title="Your Shows" />
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4 md:gap-5 mt-2">
            {shows.map((show, i) => (
              <ScrollReveal key={show.id} delay={i * 0.04}>
                <PortraitShowCard show={show} initialSaved={true} userId={user.id} />
              </ScrollReveal>
            ))}
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center gap-4 py-32 text-center">
          <h3 className="text-xl font-semibold text-white">Your list is empty</h3>
          <p className="text-sm text-white/50">Save shows to watch them later.</p>
          <Link
            href="/"
            className="rounded-full border border-white/20 text-white/70 px-6 py-2 text-sm hover:border-white/40 hover:text-white transition-all duration-200"
          >
            Browse Shows
          </Link>
        </div>
      )}
    </div>
  )
}
