import { Star } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
export interface ShowReview {
  id: string
  showId: string
  authorName: string
  rating: number
  text: string
  date: string
}

interface ReviewsSectionProps {
  reviews: ShowReview[]
}

export function ReviewsSection({ reviews }: ReviewsSectionProps) {
  if (reviews.length === 0) return null

  return (
    <section className="px-6 md:px-12 mt-10">
      <h2 className="font-display text-xl font-medium text-foreground">Reviews</h2>
      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
        {reviews.map((review) => (
          <Card key={review.id} className="rounded-[4px] border border-[var(--line)] bg-[var(--bg-1)]">
            <CardContent className="p-4">
              <div className="flex items-center gap-1">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star
                    key={i}
                    className={`size-4 ${
                      i < review.rating
                        ? 'fill-brand-yellow text-brand-yellow'
                        : 'text-text-muted'
                    }`}
                  />
                ))}
              </div>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground line-clamp-3">
                {review.text}
              </p>
              <div className="mt-3 flex items-center justify-between">
                <span className="text-sm font-medium text-foreground">{review.authorName}</span>
                <span className="text-xs text-text-muted">
                  {new Date(review.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      <Button variant="secondary" className="mt-6" disabled>
        Add Your Review
      </Button>
    </section>
  )
}
