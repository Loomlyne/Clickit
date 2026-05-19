import { createClient } from '@/lib/supabase/server'
import { ReviewsTable } from '@/components/admin/reviews-table'
import type { Database } from '@/lib/database.types'

type Review = Database['public']['Tables']['reviews']['Row']

type ReviewRow = Review & {
  profiles?: { display_name: string | null; avatar_url: string | null } | null
  shows?: { title: string; slug: string } | null
}

export default async function AdminReviewsPage() {
  const supabase = await createClient()

  const { data: reviews, error } = await supabase
    .from('reviews')
    .select(
      '*, profiles:profiles!reviews_user_id_fkey(display_name, avatar_url), shows(title, slug)'
    )
    .order('created_at', { ascending: false })

  return (
    <div className="space-y-6">
      <ReviewsTable
        reviews={(reviews as ReviewRow[] | null) ?? []}
        loadError={error?.message ?? null}
      />
    </div>
  )
}
