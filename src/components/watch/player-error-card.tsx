'use client'

import { useLocale, useTranslations } from 'next-intl'

import { Link } from '@/i18n/navigation'
import { Button } from '@/components/ui/button'
import { cardGlow } from '@/components/watch/up-next-card'
import { isolate } from '@/lib/i18n-format'
import type { errorCardFor } from '@/lib/watch/player-errors'

export type PlayerErrorCardProps = {
  spec: ReturnType<typeof errorCardFor>
  show: { title: string; slug: string; brandHex: string }
  /** Runs the primary action: play the next episode or try this one again. */
  onPrimary: () => void
  hasNext: boolean
}

/**
 * Branded "this episode can't play" card (D-11, UI-SPEC section 4.3). Fills the
 * video box while the iframe is hidden. The alert role announces it once; focus
 * is not moved.
 */
export function PlayerErrorCard({
  spec,
  show,
  onPrimary,
  hasNext,
}: PlayerErrorCardProps) {
  const t = useTranslations('player')
  const tWatch = useTranslations('watch')
  const locale = useLocale()

  // No next episode: Back to the show is the only way on, so it is primary.
  const backIsPrimary =
    spec.primary === 'backToShow' ||
    (spec.primary === 'playNextEpisode' && !hasNext)
  const showBack = backIsPrimary || spec.secondary === 'backToShow'

  const backLabel = tWatch('backToShow', { title: isolate(show.title) })

  return (
    <div
      role="alert"
      className="@container absolute inset-0 overflow-hidden"
      style={{ background: cardGlow(show.brandHex, locale === 'ar') }}
    >
      <div className="flex h-full flex-col justify-center p-4 @min-[560px]:items-start @min-[560px]:px-12 @min-[560px]:py-6">
        <span
          aria-hidden
          className="mb-4 hidden size-11 items-center justify-center rounded-full border border-[var(--line-2)] text-[20px] font-bold text-[var(--primary)] @min-[560px]:flex"
        >
          !
        </span>
        <h2 className="mb-2 line-clamp-2 text-[20px] leading-tight font-bold text-[var(--text)] @min-[560px]:text-[24px]">
          {t('errorTitle')}
        </h2>
        <p className="mb-3 line-clamp-2 max-w-[440px] text-sm text-[var(--text-dim)] @min-[560px]:mb-6 @min-[560px]:line-clamp-none">
          {t(spec.reasonKey)}
          {spec.showReportedLine && !spec.site
            ? ` ${t('errorReported')}`
            : null}
        </p>
        <div className="flex gap-2">
          {backIsPrimary ? null : (
            <Button
              onClick={onPrimary}
              className="min-h-11 flex-1 px-6 py-2 text-sm font-bold @min-[560px]:flex-none"
            >
              {t(spec.primary === 'tryAgain' ? 'tryAgain' : 'playNextEpisode')}
            </Button>
          )}
          {showBack ? (
            <Button
              asChild
              variant={backIsPrimary ? 'default' : 'outline'}
              className="min-h-11 min-w-0 flex-1 px-6 py-2 text-sm font-bold @min-[560px]:flex-none"
            >
              <Link href={`/series/${show.slug}`}>
                <span className="truncate">{backLabel}</span>
              </Link>
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  )
}
