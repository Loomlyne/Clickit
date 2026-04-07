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
    <div className="space-y-6">
      <ShowsTable shows={shows ?? []} />
    </div>
  )
}
