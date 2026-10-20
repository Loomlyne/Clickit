// Loading skeletons for the viewer routes (signed off by Koss 2026-10-20,
// .planning/perf/skeletons-before-after.png). Each screen copies the real
// page's boxes (sizes, radius, spacing) so nothing jumps when content lands.
// Colours come only from surface tokens via .skeleton-bone (globals.css),
// which also stops the shimmer for prefers-reduced-motion and mirrors it in
// RTL. Logical start/end classes keep the layout right for /ar.
import { useTranslations } from 'next-intl'

import { cn } from '@/lib/utils'

export function Bone({
  className,
  style,
}: {
  className?: string
  style?: React.CSSProperties
}) {
  return (
    <div aria-hidden className={cn('skeleton-bone', className)} style={style} />
  )
}

/**
 * The bones sit in an aria-busy container (each bone is aria-hidden). The
 * "Loading" text is a sibling status region, outside the busy subtree so it is
 * not held back. It mounts with its text, so the announcement is best effort:
 * most screen readers read a new status region, some only on focus.
 */
function SkeletonScreen({
  className,
  children,
}: {
  className?: string
  children: React.ReactNode
}) {
  const t = useTranslations('common')
  return (
    <>
      <span role="status" aria-live="polite" className="sr-only">
        {t('loading')}
      </span>
      <div aria-busy="true" className={className}>
        {children}
      </div>
    </>
  )
}

const range = (n: number) => Array.from({ length: n }, (_, i) => i)

// ---------------------------------------------------------------------------
// Rails (shared by the hub and the series "more shows" row)
// ---------------------------------------------------------------------------

/** Mirrors ContentRail: 16:9 cards at --landscape-w, stacked full width on phones. */
export function RailSkeleton({ cards = 5 }: { cards?: number }) {
  return (
    <section className="rail px-10 pt-8 pb-3">
      <div className="mb-4 flex min-h-11 items-start">
        <Bone className="h-[26px] w-48 rounded-[6px]" />
      </div>
      <div className="content-rail-track flex flex-col gap-[var(--rail-gap)] overflow-hidden py-1.5 pb-5 sm:flex-row">
        {range(cards).map((i) => (
          <Bone
            key={i}
            className={cn(
              'flex-shrink-0 rounded-[12px]',
              // Phones show three stacked cards, not the whole row.
              i > 2 && 'max-sm:hidden'
            )}
            style={{ width: 'var(--landscape-w)', aspectRatio: '16 / 9' }}
          />
        ))}
      </div>
    </section>
  )
}

/** Mirrors ShortsRail: 180px 9:16 cards with an 11px media radius. */
function ShortsRailSkeleton() {
  return (
    <section className="rail px-10 pt-8 pb-3">
      <div className="mb-4 flex min-h-11 items-start">
        <Bone className="h-[26px] w-36 rounded-[6px]" />
      </div>
      <div className="flex gap-5 overflow-hidden pt-1 pb-3">
        {range(7).map((i) => (
          <Bone
            key={i}
            className="shrink-0 rounded-[11px]"
            style={{ width: 180, aspectRatio: '9 / 16' }}
          />
        ))}
      </div>
    </section>
  )
}

// ---------------------------------------------------------------------------
// 1 + 2 · Watch hub (/watch, /browse) — hero + shorts + program rails
// ---------------------------------------------------------------------------

export function HubSkeleton() {
  return (
    <SkeletonScreen>
      {/* HeroBanner: 78vh, content anchored bottom-start, max 620px */}
      <div className="relative -mt-16 mb-3 h-[78vh] min-h-[480px] overflow-hidden bg-[var(--bg-1)] md:min-h-[580px]">
        <div className="absolute start-5 end-5 bottom-8 max-w-[620px] sm:start-10 sm:end-10 sm:bottom-20">
          <Bone className="mb-3 h-[clamp(28px,6vw,84px)] w-3/4 rounded-[8px] sm:mb-[18px]" />
          <Bone className="mb-3 h-3 w-52 rounded-full sm:mb-[18px]" />
          <Bone className="mb-2 h-3.5 w-full max-w-[560px] rounded-full" />
          <Bone className="mb-4 h-3.5 w-2/3 max-w-[400px] rounded-full sm:mb-6" />
          <div className="flex gap-2">
            <Bone className="h-11 w-28 rounded-full sm:h-[50px] sm:w-40" />
            <Bone className="h-11 w-24 rounded-full sm:h-[50px] sm:w-36" />
          </div>
        </div>
      </div>
      <ShortsRailSkeleton />
      <RailSkeleton />
      <RailSkeleton />
    </SkeletonScreen>
  )
}

// ---------------------------------------------------------------------------
// 2 · My List — left-aligned header + 2:3 poster grid
// ---------------------------------------------------------------------------

export function MyListSkeleton() {
  return (
    <SkeletonScreen className="pb-20">
      <div className="px-6 pt-16 pb-12 md:px-12">
        <div className="mx-auto max-w-5xl">
          <Bone className="mb-4 h-3 w-20 rounded-full" />
          <Bone className="h-[clamp(2.5rem,5vw,56px)] w-64 max-w-full rounded-[8px]" />
          <Bone className="mt-3 h-4 w-40 rounded-full" />
        </div>
      </div>
      <div className="mx-auto max-w-5xl px-6 md:px-12">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:gap-5 lg:grid-cols-4 xl:grid-cols-5">
          {range(10).map((i) => (
            <div key={i} className={cn(i > 5 && 'max-sm:hidden')}>
              <Bone className="aspect-[2/3] w-full rounded-[12px]" />
              <div className="px-0.5 pt-2.5">
                <Bone className="h-3.5 w-3/4 rounded-full" />
                <Bone className="mt-1.5 h-3 w-1/2 rounded-full" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </SkeletonScreen>
  )
}

// ---------------------------------------------------------------------------
// 3 · Series page — hero + season tabs + episode rows
// ---------------------------------------------------------------------------

function EpisodeRowSkeleton() {
  return (
    <div className="flex items-start gap-4 rounded-[12px] border border-[var(--line)] bg-[var(--bg-1)] p-4">
      <Bone className="aspect-video w-[120px] flex-shrink-0 rounded-[11px] sm:w-[160px] md:w-[180px]" />
      <div className="flex min-w-0 flex-1 flex-col justify-center pt-1">
        <div className="flex items-center gap-3">
          <Bone className="h-7 w-7 flex-shrink-0 rounded-[6px]" />
          <Bone className="h-4 w-1/2 rounded-[6px]" />
        </div>
        <Bone className="mt-2 h-3 w-5/6 rounded-full" />
        <Bone className="mt-2 h-3 w-24 rounded-full" />
      </div>
    </div>
  )
}

export function SeriesSkeleton() {
  return (
    <SkeletonScreen className="-mt-16">
      {/* SeriesDetailHero: 72vh, content bottom-start, max 720px */}
      <div className="relative h-[72vh] min-h-[460px] overflow-hidden bg-[var(--bg-1)] md:min-h-[520px]">
        <div className="absolute start-4 end-4 bottom-10 z-10 max-w-[720px] sm:start-10 sm:end-10 sm:bottom-[60px]">
          <Bone className="mb-4 h-3 w-24 rounded-full" />
          <Bone className="mb-5 h-[clamp(36px,6vw,72px)] w-3/4 rounded-[8px]" />
          <Bone className="mb-2 h-3.5 w-full rounded-full" />
          <Bone className="mb-6 h-3.5 w-2/3 rounded-full" />
          <div className="flex items-center gap-3">
            <Bone className="h-11 w-36 rounded-full" />
            <Bone className="size-11 rounded-full" />
            <Bone className="size-11 rounded-full" />
          </div>
        </div>
      </div>

      <div className="mt-8 px-6 md:px-12">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-col gap-8 lg:flex-row">
            <div className="min-w-0 flex-1">
              <div className="rounded-[12px] border border-[var(--line)] bg-[var(--bg-1)] p-4 sm:p-6">
                <div className="flex gap-2 border-b border-[var(--line)] pb-3">
                  <Bone className="h-9 w-24 rounded-full" />
                  <Bone className="h-9 w-24 rounded-full" />
                </div>
                <div className="mt-6 space-y-3 px-4 md:space-y-4">
                  {range(4).map((i) => (
                    <EpisodeRowSkeleton key={i} />
                  ))}
                </div>
              </div>
            </div>
            <div className="hidden w-72 shrink-0 lg:block">
              <Bone className="h-[320px] w-full rounded-[12px]" />
            </div>
          </div>
        </div>
      </div>
    </SkeletonScreen>
  )
}

// ---------------------------------------------------------------------------
// 4 · Watch page — black player (no grey flash), top bar, 134px tray
// ---------------------------------------------------------------------------

export function WatchSkeleton() {
  return (
    <SkeletonScreen className="fixed inset-0 flex h-dvh flex-col bg-black">
      {/* Top bar: back · title/meta · save, like, share */}
      <div className="flex items-center justify-between border-b border-[var(--line)] bg-[var(--bg-0)]/90 px-4 [padding-top:max(1rem,env(safe-area-inset-top))] pb-4">
        <Bone className="h-4 w-16 rounded-full" />
        <div className="flex flex-col items-center gap-1.5">
          <Bone className="h-3.5 w-40 rounded-full" />
          <Bone className="h-3 w-24 rounded-full" />
        </div>
        <div className="flex items-center gap-3">
          <Bone className="size-6 rounded-full" />
          <Bone className="size-6 rounded-full" />
          <Bone className="size-6 rounded-full" />
        </div>
      </div>

      {/* Player stays black; a quiet play mark instead of a pulsing panel */}
      <div className="flex min-h-0 w-full flex-1 items-center justify-center bg-black">
        <div
          aria-hidden
          className="flex size-16 items-center justify-center rounded-full border border-[var(--line-2)] bg-[var(--bg-1)]"
        >
          {/* Play glyphs do not mirror in RTL, so physical left on purpose */}
          <span className="ml-1 block h-0 w-0 border-y-[11px] border-l-[18px] border-y-transparent border-l-[var(--bg-4)]" />
        </div>
      </div>

      {/* Episode tray at its first snap point (WATCH_TRAY_SNAP_POINTS[0]) */}
      <div className="h-[134px] w-full shrink-0 border-t border-[var(--line)] bg-[var(--bg-0)] px-4 py-3">
        <div className="flex items-center gap-3">
          <Bone className="h-[88px] w-[60px] shrink-0 rounded-[11px]" />
          <div className="flex-1 space-y-2 overflow-hidden">
            <Bone className="h-3 w-20 rounded-full" />
            <Bone className="h-4 w-3/4 rounded-[6px]" />
            <Bone className="h-3 w-full rounded-full" />
            <Bone className="h-3 w-2/3 rounded-full" />
          </div>
          <Bone className="size-5 shrink-0 rounded-[6px]" />
        </div>
      </div>
    </SkeletonScreen>
  )
}
