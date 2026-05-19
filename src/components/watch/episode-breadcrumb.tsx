'use client'

import { useTranslations } from 'next-intl'

interface EpisodeBreadcrumbProps {
  seasonNumber: number
  episodeNumber: number
}

export function EpisodeBreadcrumb({
  seasonNumber,
  episodeNumber,
}: EpisodeBreadcrumbProps) {
  const tNav = useTranslations('nav')
  const tShow = useTranslations('show')
  return (
    <nav aria-label={tNav('breadcrumb')}>
      <ol className="flex items-center gap-2 text-sm">
        <li className="text-text-muted">
          {tShow('seasonPrefix')} {seasonNumber}
        </li>
        <li aria-hidden="true" className="text-text-muted">
          &gt;
        </li>
        <li aria-current="page" className="text-foreground">
          {tShow('episodePrefix')} {episodeNumber}
        </li>
      </ol>
    </nav>
  )
}
