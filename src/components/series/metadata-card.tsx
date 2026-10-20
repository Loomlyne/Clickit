import { Star } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import type { ViewShow } from '@/lib/queries'

interface MetadataCardProps {
  show: ViewShow
}

// Phone/tablet summary (the sidebar card below is lg-only): ratings, seasons.
export function MetadataStrip({ show }: MetadataCardProps) {
  const t = useTranslations('show')
  const cells = [
    show.imdbRating && { k: t('imdbLabel'), v: `★ ${show.imdbRating}` },
    show.platformRating && {
      k: t('citRatingLabel'),
      v: `★ ${show.platformRating}`,
    },
    { k: t('seasonsLabel'), v: String(show.seasonCount) },
  ].filter(Boolean) as { k: string; v: string }[]
  return (
    <Card className="mb-4 flex-row gap-0 p-0 lg:hidden">
      {cells.map((c) => (
        <div
          key={c.k}
          className="min-w-0 flex-1 border-e border-[var(--line)] px-4 py-3 last:border-e-0"
        >
          <div className="label truncate">{c.k}</div>
          <div className="mt-0.5 text-sm font-medium text-[var(--text)]">
            {c.v}
          </div>
        </div>
      ))}
    </Card>
  )
}

export function MetadataCard({ show }: MetadataCardProps) {
  const t = useTranslations('show')
  return (
    <Card className="sticky top-28">
      <CardContent className="space-y-4 p-6">
        <div className="space-y-2">
          {show.imdbRating && (
            <div className="flex items-center justify-between">
              <span className="text-text-muted text-xs font-medium tracking-wide uppercase">
                {t('imdbLabel')}
              </span>
              <div className="flex items-center gap-1">
                <Star className="fill-brand-yellow text-brand-yellow size-3.5" />
                <span className="text-foreground text-sm font-medium">
                  {show.imdbRating}/10
                </span>
              </div>
            </div>
          )}
          {show.platformRating && (
            <div className="flex items-center justify-between">
              <span className="text-text-muted text-xs font-medium tracking-wide uppercase">
                {t('citRatingLabel')}
              </span>
              <div className="flex items-center gap-1">
                <Star className="fill-brand-orange text-brand-orange size-3.5" />
                <span className="text-foreground text-sm font-medium">
                  {show.platformRating}/5
                </span>
              </div>
            </div>
          )}
        </div>

        <Separator />

        <div>
          <p className="text-text-muted text-xs font-medium tracking-wide uppercase">
            {t('genreLabel')}
          </p>
          <Badge variant="secondary" className="mt-1">
            {show.genre}
          </Badge>
        </div>

        <Separator />

        <div>
          <p className="text-text-muted text-xs font-medium tracking-wide uppercase">
            {t('seasonsLabel')}
          </p>
          <p className="text-foreground mt-1 text-sm">{show.seasonCount}</p>
        </div>

        <Separator />

        <div>
          <p className="text-text-muted text-xs font-medium tracking-wide uppercase">
            {t('episodesLabel')}
          </p>
          <p className="text-foreground mt-1 text-sm">{show.episodeCount}</p>
        </div>
      </CardContent>
    </Card>
  )
}
