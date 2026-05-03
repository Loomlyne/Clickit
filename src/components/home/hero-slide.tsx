// Hero slide — matches handoff .hero-content
// Sharp, minimal: eyebrow + title + meta + synopsis + 3 buttons
'use client'

import { Link } from '@/i18n/navigation'
import { Play, Info } from 'lucide-react'

import { CinematicBackdrop } from '@/components/primitives/cinematic-backdrop'
import type { ViewShow } from '@/lib/queries'
import { BRAND_COLOR_HEX } from '@/lib/brand-colors'

interface HeroSlideProps {
  show: ViewShow
  isActive: boolean
  firstEpisodeId?: string
  isMobile?: boolean
  reducedMotion?: boolean
}

export function HeroSlide({ show, isActive, firstEpisodeId, isMobile, reducedMotion }: HeroSlideProps) {
  const brandColorHex = BRAND_COLOR_HEX[show.brandColor]

  return (
    <div className="absolute inset-0">
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
      />

      {/* Scrim — matches handoff: left vignette + bottom fade */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `
            linear-gradient(90deg, rgba(10,10,10,0.9) 0%, rgba(10,10,10,0.5) 40%, transparent 70%),
            linear-gradient(180deg, transparent 40%, var(--bg-0) 98%)
          `,
        }}
      />

      {/* Content — positioned bottom-left, max 620px */}
      <div className="absolute bottom-20 start-10 end-10 max-w-[620px]">
        {/* Eyebrow */}
        <div className="mono mb-3.5 flex items-center gap-2.5" style={{ color: 'var(--accent)', letterSpacing: '0.18em' }}>
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--accent)]" />
          Featured · {show.genre.toUpperCase()}
        </div>

        {/* Title */}
        <h1
          className="font-display m-0 mb-[18px] font-normal leading-[0.95] text-white"
          style={{ fontSize: 'clamp(48px, 6vw, 84px)', letterSpacing: '-0.02em' }}
        >
          {show.title}
        </h1>

        {/* Meta row */}
        <div className="mono mb-[18px] flex items-center gap-3.5" style={{ letterSpacing: '0.12em' }}>
          <span>{show.seasonCount} Season{show.seasonCount !== 1 ? 's' : ''}</span>
          <span className="inline-block h-[3px] w-[3px] rounded-full bg-[var(--text-mute)]" />
          <span>{show.episodeCount} episodes</span>
          <span className="inline-block h-[3px] w-[3px] rounded-full bg-[var(--text-mute)]" />
          <span>{show.genre}</span>
        </div>

        {/* Synopsis */}
        <p className="m-0 mb-6 max-w-[560px] text-[16px] text-[var(--text-dim)]" style={{ textWrap: 'pretty' }}>
          {show.description}
        </p>

        {/* Actions — 3 buttons matching handoff */}
        <div className="flex gap-2.5">
          {firstEpisodeId && show.status === 'streaming' ? (
            <Link
              href={`/watch/${firstEpisodeId}`}
              className="btn inline-flex items-center gap-2 whitespace-nowrap rounded-[4px] bg-primary px-[26px] py-3.5 text-[15px] font-medium text-primary-foreground transition-[transform,background] duration-[120ms] hover:bg-white active:translate-y-px"
            >
              <Play className="size-4 fill-current" /> Continue watching
            </Link>
          ) : (
            <span className="inline-flex items-center gap-2 rounded-[4px] bg-white/[0.08] border border-white/[0.08] px-[26px] py-3.5 text-[15px] font-medium text-white/50 backdrop-blur-[8px] cursor-not-allowed">
              Coming Soon
            </span>
          )}
          <Link
            href={`/series/${show.slug}`}
            className="inline-flex items-center gap-2 rounded-[4px] bg-white/[0.08] border border-white/[0.08] px-[26px] py-3.5 text-[15px] font-medium text-white backdrop-blur-[8px] transition-[transform,background,border-color] duration-[120ms] hover:bg-white/[0.14] hover:border-[var(--line-2)] active:translate-y-px"
          >
            <Info className="size-4" /> More info
          </Link>
        </div>
      </div>
    </div>
  )
}
