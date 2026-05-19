import { Star } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import type { ViewShow } from '@/lib/queries'

interface MetadataCardProps {
  show: ViewShow
}

export function MetadataCard({ show }: MetadataCardProps) {
  const t = useTranslations('show')
  return (
    <Card className="sticky top-28 rounded-[12px] border border-[var(--line)] bg-[var(--bg-1)]">
      <CardContent className="space-y-4 p-6">
        <div className="space-y-2">
          {show.imdbRating && (
            <div className="flex items-center justify-between">
              <span className="text-text-muted text-xs font-medium tracking-wide uppercase">
                IMDb
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
                CIT Rating
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
