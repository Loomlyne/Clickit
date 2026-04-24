import { createClient } from '@/lib/supabase/server'
import { ShortsTable } from '@/components/admin/shorts-table'

export default async function AdminShortsPage() {
  const supabase = await createClient()

  const { data: shorts } = await supabase
    .from('shorts')
    .select('*')
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: false })

  return (
    <div className="space-y-6">
      <ShortsTable shorts={shorts ?? []} />
    </div>
  )
}
