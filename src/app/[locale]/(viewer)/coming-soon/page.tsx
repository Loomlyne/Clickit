import { Link } from '@/i18n/navigation'
import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'

import { Button } from '@/components/ui/button'
import { ComingSoonShowCard } from '@/components/shows/coming-soon-show-card'
import { EpisodeRow } from '@/components/series/episode-row'
import { SectionHeader } from '@/components/primitives/section-header'
import { ScrollReveal } from '@/components/primitives/scroll-reveal'
import {
  getComingSoonShows,
  getComingSoonEpisodes,
  type ViewShow,
} from '@/lib/queries'
import { BRAND_COLOR_HEX } from '@/lib/brand-colors'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('comingSoon')
  return {
    title: `${t('pageTitle')} | Clickit Story`,
    description: t('description'),
  }
}

export default async function ComingSoonPage() {
  const [t, tCommon, comingSoonShows, upcomingEpisodes] = await Promise.all([
    getTranslations('comingSoon'),
    getTranslations('common'),
    getComingSoonShows(),
    getComingSoonEpisodes(),
  ])

  // Group upcoming episodes by show for section 2 display
  const episodesByShow = upcomingEpisodes.reduce(
    (acc, ep) => {
      if (!acc[ep.showTitle]) {
        acc[ep.showTitle] = { brandColor: ep.showBrandColor, episodes: [] }
      }
      acc[ep.showTitle].episodes.push(ep)
      return acc
    },
    {} as Record<
      string,
      { brandColor: ViewShow['brandColor']; episodes: typeof upcomingEpisodes }
    >
  )

  return (
    <div className="pb-20">
      <div className="px-6 py-8 md:px-12">
        <div className="mx-auto max-w-5xl rounded-[28px] border border-white/10 bg-white/[0.03] px-8 py-12 text-center shadow-[0_24px_80px_rgba(0,0,0,0.22)]">
          <p
            className="mb-4 text-[11px] tracking-[0.28em] uppercase"
            style={{ color: 'var(--color-brand-purple-safe)' }}
          >
            {t('eyebrow')}
          </p>
          <h1
            className="font-display font-semibold leading-tight text-white"
            style={{ fontSize: 'clamp(2.5rem, 6vw, 4.5rem)' }}
          >
            {t('heading')}
          </h1>
          <p className="text-white/50 text-lg mt-3 max-w-md mx-auto">
            {t('description')}
          </p>
        </div>
      </div>

      {/* Section 1: Upcoming Shows */}
      {comingSoonShows.length > 0 ? (
        <section className="pb-12">
          <SectionHeader title={t('upcomingShowsHeading')} />
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 px-6 md:px-12 mt-2">
            {comingSoonShows.map((show, i) => (
              <ScrollReveal key={show.id} delay={i * 0.06}>
                <ComingSoonShowCard show={show} />
              </ScrollReveal>
            ))}
          </div>
        </section>
      ) : (
        <section className="px-6 md:px-12 pb-12">
          <SectionHeader title={t('upcomingShowsHeading')} />
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <h3 className="text-xl font-bold text-white">{t('noUpcomingHeading')}</h3>
            <p className="mt-2 text-sm text-white/50">
              {t('noUpcomingDescription')}
            </p>
            <Link href="/" className="mt-4">
              <Button variant="default">{tCommon('browseShows')}</Button>
            </Link>
          </div>
        </section>
      )}

      {/* Section 2: New Episodes Dropping Soon */}
      {Object.keys(episodesByShow).length > 0 ? (
        <section className="px-6 md:px-12 pb-16">
          <SectionHeader title={t('newEpisodesHeading')} />
          <div className="mt-2 space-y-8">
            {Object.entries(episodesByShow).map(
              ([showTitle, { brandColor, episodes }]) => (
                <ScrollReveal key={showTitle}>
                  <div>
                    <h3 className="mb-3 text-sm font-medium text-white/60 flex items-center gap-2">
                      <div
                        className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                        style={{ background: BRAND_COLOR_HEX[brandColor] }}
                      />
                      {showTitle}
                    </h3>
                    <div className="space-y-2">
                      {episodes.map((ep) => (
                        <EpisodeRow
                          key={ep.id}
                          episode={ep}
                          showBrandColor={brandColor}
                        />
                      ))}
                    </div>
                  </div>
                </ScrollReveal>
              )
            )}
          </div>
        </section>
      ) : (
        <section className="px-6 md:px-12 pb-16">
          <SectionHeader title={t('newEpisodesHeading')} />
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <h3 className="text-xl font-bold text-white">
              {t('noNewEpisodesHeading')}
            </h3>
            <p className="mt-2 text-sm text-white/50">
              {t('noNewEpisodesDescription')}
            </p>
          </div>
        </section>
      )}
    </div>
  )
}
