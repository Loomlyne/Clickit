import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

export type YouTubeChipTone = 'ok' | 'bad' | 'warn' | 'neutral'

export type YouTubeStatus =
  | 'ok'
  | 'private'
  | 'removed'
  | 'not_embeddable'
  | 'blocked_ae'
  | 'not_ready'
  | 'already'
  | 'needs_english'

const BASE =
  'inline-flex min-h-6 items-center gap-1 rounded-full border px-3 text-[11px] leading-none font-bold tracking-[0.04em] whitespace-nowrap'

// TODO(phase-4): the brand-*-safe tone classes may be renamed by the Phase 4 token pass
const TONE_CLASSES: Record<YouTubeChipTone, string> = {
  ok: 'border-brand-green-safe/35 bg-brand-green-safe/8 text-brand-green-safe',
  bad: 'border-brand-red-safe/35 bg-brand-red-safe/8 text-brand-red-safe',
  warn: 'border-brand-orange-safe/35 bg-brand-orange-safe/8 text-brand-orange-safe',
  neutral: 'border-[var(--line-2)] bg-transparent text-[var(--text-mute)]',
}

export function toneForYouTubeStatus(status: YouTubeStatus): YouTubeChipTone {
  switch (status) {
    case 'ok':
      return 'ok'
    case 'private':
    case 'removed':
    case 'not_embeddable':
    case 'blocked_ae':
      return 'bad'
    case 'not_ready':
    case 'needs_english':
      return 'warn'
    case 'already':
      return 'neutral'
  }
}

type YouTubeStatusChipProps = {
  tone: YouTubeChipTone
  icon?: ReactNode
  /** The status in words. Colour alone never carries the meaning. */
  children: ReactNode
  className?: string
}

export function YouTubeStatusChip({
  tone,
  icon,
  children,
  className,
}: YouTubeStatusChipProps) {
  return (
    <span className={cn(BASE, TONE_CLASSES[tone], className)}>
      {icon ? (
        <span aria-hidden className="inline-flex shrink-0 items-center">
          {icon}
        </span>
      ) : null}
      {children}
    </span>
  )
}
