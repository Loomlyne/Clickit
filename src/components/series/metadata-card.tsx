import { Star } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import type { ViewShow } from '@/lib/queries'

interface MetadataCardProps {
  show: ViewShow
}

export function MetadataCard({ show }: MetadataCardProps) {
  return (
    <Card className="sticky top-28 rounded-full border border-[var(--line)] bg-[var(--bg-1)]">
      <CardContent className="p-6 space-y-4">
        <div className="space-y-2">
          {show.imdbRating && (
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium uppercase tracking-wide text-text-muted">IMDb</span>
              <div className="flex items-center gap-1">
                <Star className="size-3.5 fill-brand-yellow text-brand-yellow" />
                <span className="text-sm font-medium text-foreground">{show.imdbRating}/10</span>
              </div>
            </div>
          )}
          {show.platformRating && (
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium uppercase tracking-wide text-text-muted">CIT Rating</span>
              <div className="flex items-center gap-1">
                <Star className="size-3.5 fill-brand-orange text-brand-orange" />
                <span className="text-sm font-medium text-foreground">{show.platformRating}/5</span>
              </div>
            </div>
          )}
        </div>

        <Separator />

        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-text-muted">Genre</p>
          <Badge variant="secondary" className="mt-1">{show.genre}</Badge>
        </div>

        <Separator />

        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-text-muted">Seasons</p>
          <p className="mt-1 text-sm text-foreground">{show.seasonCount}</p>
        </div>

        <Separator />

        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-text-muted">Episodes</p>
          <p className="mt-1 text-sm text-foreground">{show.episodeCount}</p>
        </div>
      </CardContent>
    </Card>
  )
}
