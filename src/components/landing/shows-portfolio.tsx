import { getFeaturedShorts } from '@/lib/queries'
import { FeaturedShortsGrid } from './featured-shorts-strip'

export async function ShowsPortfolio() {
  const shorts = await getFeaturedShorts()

  if (shorts.length === 0) return null

  return (
    <section className="mx-auto max-w-[1400px] px-4 py-24 sm:px-6 md:px-10" id="shows">
      <div className="mono mb-3.5 text-[var(--text-mute)]">002 · What to watch</div>
      <h2 className="font-[family-name:var(--font-display)] text-[clamp(36px,5vw,64px)] font-normal leading-none tracking-[-0.02em] mb-12 max-w-[800px]">
        The ones worth your time.
      </h2>
      <FeaturedShortsGrid shorts={shorts} />
    </section>
  )
}
