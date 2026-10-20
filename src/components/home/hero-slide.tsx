// Hero slide — matches handoff .hero-content
// Sharp, minimal: eyebrow + title + meta + synopsis + 3 buttons
'use client'

import { useTranslations } from 'next-intl'
import { Link } from '@/i18n/navigation'
import { Play, Info } from 'lucide-react'

import { CinematicBackdrop } from '@/components/primitives/cinematic-backdrop'
import type { ViewShow } from '@/lib/queries'
import { BRAND_COLOR_HEX } from '@/lib/brand-colors'

interface HeroSlideProps {
  show: ViewShow
  isActive: boolean
  firstEpisodeId?: string
  hasWatched?: boolean
  isMobile?: boolean
  reducedMotion?: boolean
  onContentHoverChange?: (isHovering: boolean) => void
}

export function HeroSlide({
  show,
  isActive,
  firstEpisodeId,
  hasWatched = false,
  isMobile,
  reducedMotion,
  onContentHoverChange,
}: HeroSlideProps) {
  const t = useTranslations('home')
  const brandColorHex = BRAND_COLOR_HEX[show.brandColor]

  return (
    <div className="pointer-events-none absolute inset-0">
      {/* Background image with cinematic bloom */}
      <CinematicBackdrop
        brandColor={brandColorHex}
        intensity="high"
        watermarkText={show.title.split(' ')[0]}
        className="absolute inset-0"
        imageUrl={show.heroImageUrl}
        mobileImageUrl={show.heroImageMobileUrl}
        videoUrl={show.heroVideoUrl}
        videoType={show.heroVideoType}
        mobileVideoUrl={show.heroVideoMobileUrl}
        mobileVideoType={show.heroVideoMobileType}
        isMobile={isMobile}
        reducedMotion={reducedMotion}
        isActive={isActive}
      />

      {/* Scrim — matches handoff: left vignette + bottom fade */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: `
            linear-gradient(90deg, rgba(10,10,10,0.9) 0%, rgba(10,10,10,0.5) 40%, transparent 70%),
            linear-gradient(180deg, transparent 40%, var(--bg-0) 98%)
          `,
        }}
      />

      {/* Content — positioned bottom-left, max 620px */}
      <div
        className="pointer-events-auto absolute start-5 end-5 bottom-8 max-w-[620px] sm:start-10 sm:end-10 sm:bottom-20"
        onMouseEnter={() => onContentHoverChange?.(true)}
        onMouseLeave={() => onContentHoverChange?.(false)}
      >
        {/* Title */}
        <h1
          className="font-display m-0 mb-3 leading-[0.95] font-normal text-white sm:mb-[18px]"
          style={{
            fontSize: 'clamp(28px, 6vw, 84px)',
            letterSpacing: '-0.02em',
          }}
        >
          {show.title}
        </h1>

        {/* Meta row */}
        <div
          className="mono mb-3 flex items-center gap-2 sm:mb-[18px] sm:gap-3.5"
          style={{ letterSpacing: '0.12em' }}
        >
          <span>{t('seasonCount', { count: show.seasonCount })}</span>
          <span className="inline-block h-[3px] w-[3px] rounded-full bg-[var(--text-mute)]" />
          <span>{t('episodeCount', { count: show.episodeCount })}</span>
          <span className="inline-block h-[3px] w-[3px] rounded-full bg-[var(--text-mute)]" />
          <span>{show.genre}</span>
        </div>

        {/* Synopsis */}
        <p
          className="m-0 mb-4 max-w-[560px] text-[14px] text-[var(--text-dim)] sm:mb-6 sm:text-[16px]"
          style={{ textWrap: 'pretty' }}
        >
          {show.description}
        </p>

        {/* Actions */}
        <div className="flex gap-2">
          {firstEpisodeId && show.status === 'streaming' ? (
            <Link
              href={`/watch/${firstEpisodeId}`}
              className="btn bg-primary text-primary-foreground inline-flex min-h-11 items-center gap-1.5 rounded-full px-4 py-2.5 text-[13px] font-medium whitespace-nowrap transition-[transform,background] duration-[120ms] hover:bg-white active:translate-y-px sm:gap-2 sm:px-[26px] sm:py-3.5 sm:text-[15px]"
            >
              <Play className="size-3.5 fill-current sm:size-4" />
              <span className="sm:hidden">{t('play')}</span>
              <span className="hidden sm:inline">
                {hasWatched ? t('continueWatching') : t('watchNow')}
              </span>
            </Link>
          ) : (
            <span className="inline-flex min-h-11 cursor-not-allowed items-center gap-1.5 rounded-full border border-white/[0.08] bg-white/[0.08] px-4 py-2.5 text-[13px] font-medium text-[var(--text-mute)] backdrop-blur-[8px] sm:px-[26px] sm:py-3.5 sm:text-[15px]">
              {t('comingSoonBadge')}
            </span>
          )}
          <Link
            href={`/series/${show.slug}`}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-white/[0.08] bg-white/[0.08] px-4 py-2.5 text-[13px] font-medium text-white backdrop-blur-[8px] transition-[transform,background,border-color] duration-[120ms] hover:border-[var(--line-2)] hover:bg-white/[0.14] active:translate-y-px sm:gap-2 sm:px-[26px] sm:py-3.5 sm:text-[15px]"
          >
            <Info className="size-3.5 sm:size-4" />
            <span className="sm:hidden">{t('info')}</span>
            <span className="hidden sm:inline">{t('moreInfo')}</span>
          </Link>
        </div>
      </div>
    </div>
  )
}
