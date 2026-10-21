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

const TONE_CLASSES: Record<YouTubeChipTone, string> = {
  ok: 'border-status-success/35 bg-status-success/8 text-status-success',
  bad: 'border-status-danger/35 bg-status-danger/8 text-status-danger',
  warn: 'border-status-warning/35 bg-status-warning/8 text-status-warning',
  neutral: 'border-status-neutral-line bg-transparent text-status-neutral',
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
