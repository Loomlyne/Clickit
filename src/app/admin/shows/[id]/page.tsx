import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { StatusBadge } from '@/components/admin/status-badge'
import { SeasonTabs } from '@/components/admin/season-tabs'
import type { Database } from '@/lib/database.types'

type Episode = Database['public']['Tables']['episodes']['Row']

export default async function ShowDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const { data: show } = await supabase
    .from('shows')
    .select('*')
    .eq('id', id)
    .single()

  if (!show) notFound()

  const { data: seasons } = await supabase
    .from('seasons')
    .select('*')
    .eq('show_id', id)
    .order('season_number', { ascending: true })

  const { data: episodes } = await supabase
    .from('episodes')
    .select('*')
    .eq('show_id', id)
    .eq('archived', false)
    .order('episode_number', { ascending: true })

  const episodesBySeason: Record<string, Episode[]> = {}
  for (const ep of episodes ?? []) {
    if (!episodesBySeason[ep.season_id]) {
      episodesBySeason[ep.season_id] = []
    }
    episodesBySeason[ep.season_id].push(ep)
  }

  return (
    <div>
      {/* Back link */}
      <Link
        href="/admin"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4"
      >
        <ArrowLeft className="size-4" />
        All Shows
      </Link>

      {/* Show info card */}
      <div className="rounded-lg border border-border bg-[var(--card)] p-5 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold">{show.title}</h1>
            <div className="flex items-center gap-3 mt-2 text-sm text-muted-foreground">
              <span>{show.genre}</span>
              <span>·</span>
              <span>{show.episode_count} episodes</span>
              <span>·</span>
              <span>{(seasons ?? []).length} season{(seasons ?? []).length !== 1 ? 's' : ''}</span>
              {show.broadcast_day && (
                <>
                  <span>·</span>
                  <span>{show.broadcast_day} {show.broadcast_time}</span>
                </>
              )}
            </div>
          </div>
          <StatusBadge status={show.status} />
        </div>
      </div>

      {/* Season tabs with episodes */}
      <SeasonTabs
        seasons={seasons ?? []}
        episodesBySeason={episodesBySeason}
        showId={id}
      />
    </div>
  )
}
