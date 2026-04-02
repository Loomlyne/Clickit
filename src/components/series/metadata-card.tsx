import { Star } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import type { Show } from '@/lib/mock-data'

interface MetadataCardProps {
  show: Show
}

export function MetadataCard({ show }: MetadataCardProps) {
  return (
    <Card className="sticky top-20 bg-card border-border">
      <CardContent className="p-5 space-y-4">
        {show.releaseYear && (
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-text-muted">Release Year</p>
            <p className="mt-1 text-sm text-foreground">{show.releaseYear}</p>
          </div>
        )}

        <Separator />

        {show.languages && show.languages.length > 0 && (
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-text-muted">Languages</p>
            <p className="mt-1 text-sm text-foreground">{show.languages.join(', ')}</p>
          </div>
        )}

        <Separator />

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

        {show.director && (
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-text-muted">Director</p>
            <p className="mt-1 text-sm text-foreground">{show.director}</p>
          </div>
        )}

        <Separator />

        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-text-muted">Genre</p>
          <Badge variant="secondary" className="mt-1">{show.genre}</Badge>
        </div>

        {show.viewCount && (
          <>
            <Separator />
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-text-muted">Views</p>
              <p className="mt-1 text-sm text-foreground">{show.viewCount.toLocaleString()}</p>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
