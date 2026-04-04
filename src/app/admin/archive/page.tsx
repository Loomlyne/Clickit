import { createClient } from '@/lib/supabase/server'
import { AlertTriangle } from 'lucide-react'
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
      <h1 className="text-xl font-semibold mb-4">Archive</h1>

      {/* Warning banner */}
      <div className="flex items-start gap-3 rounded-lg border border-yellow-500/20 bg-yellow-500/5 px-4 py-3 mb-6">
        <AlertTriangle className="size-5 text-yellow-500 shrink-0 mt-0.5" />
        <div className="text-sm">
          <p className="text-yellow-200 font-medium">Archived shows are hidden from viewers</p>
          <p className="text-yellow-200/60 mt-0.5">Permanently deleted shows and all their seasons and episodes cannot be recovered.</p>
        </div>
      </div>

      <ArchiveTable shows={shows ?? []} />
    </div>
  )
}
