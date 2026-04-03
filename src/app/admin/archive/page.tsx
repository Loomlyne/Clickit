import { createClient } from '@/lib/supabase/server'
import { ArchiveTable } from '@/components/admin/archive-table'

export default async function ArchivePage() {
  const supabase = await createClient()

  const { data: shows } = await supabase
    .from('shows')
    .select('*')
    .eq('archived', true)
    .order('updated_at', { ascending: false })

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold">Archive</h1>
      </div>
      <ArchiveTable shows={shows ?? []} />
    </div>
  )
}
