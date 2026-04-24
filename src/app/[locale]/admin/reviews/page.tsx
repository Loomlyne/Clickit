import { createClient } from '@/lib/supabase/server'
import { ReviewsTable } from '@/components/admin/reviews-table'

export default async function AdminReviewsPage() {
  const supabase = await createClient()

  const { data: reviews } = await supabase
    .from('reviews')
    .select('*, profiles(display_name, avatar_url), shows(title, slug)')
    .order('created_at', { ascending: false })

  return (
    <div className="space-y-6">
      <ReviewsTable reviews={(reviews as any) ?? []} />
    </div>
  )
}
