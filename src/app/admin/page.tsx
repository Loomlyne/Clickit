import { createClient } from '@/lib/supabase/server'
import { ShowsTable } from '@/components/admin/shows-table'

export default async function AdminPage() {
  const supabase = await createClient()

  // Admin RLS policy lets admin see all shows (including drafts)
  // Filter out archived shows for the main list
  const { data: shows } = await supabase
    .from('shows')
    .select('*')
    .eq('archived', false)
    .order('created_at', { ascending: false })

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold">Shows</h1>
      </div>
      <ShowsTable shows={shows ?? []} />
    </div>
  )
}
