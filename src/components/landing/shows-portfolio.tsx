import { getTranslations } from 'next-intl/server'
import { getFeaturedShorts } from '@/lib/queries'
import { FeaturedShortsGrid } from './featured-shorts-strip'

export async function ShowsPortfolio() {
  const [shorts, t] = await Promise.all([
    getFeaturedShorts(),
    getTranslations('landing'),
  ])

  if (shorts.length === 0) return null

  return (
    <section
      className="mx-auto max-w-[1400px] px-4 py-24 sm:px-6 md:px-10"
      id="shows"
    >
      <h2 className="mb-12 max-w-[800px] font-[family-name:var(--font-display)] text-[clamp(36px,5vw,64px)] leading-none font-normal tracking-[-0.02em]">
        {t('portfolioHeading')}
      </h2>
      <FeaturedShortsGrid shorts={shorts} />
    </section>
  )
}
