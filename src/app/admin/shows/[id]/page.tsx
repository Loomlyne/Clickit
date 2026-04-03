import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
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

  // Fetch show
  const { data: show } = await supabase
    .from('shows')
    .select('*')
    .eq('id', id)
    .single()

  if (!show) notFound()

  // Fetch seasons ordered by season_number
  const { data: seasons } = await supabase
    .from('seasons')
    .select('*')
    .eq('show_id', id)
    .order('season_number', { ascending: true })

  // Fetch all non-archived episodes for this show, ordered by episode_number
  const { data: episodes } = await supabase
    .from('episodes')
    .select('*')
    .eq('show_id', id)
    .eq('archived', false)
    .order('episode_number', { ascending: true })

  // Group episodes by season_id
  const episodesBySeason: Record<string, Episode[]> = {}
  for (const ep of episodes ?? []) {
    if (!episodesBySeason[ep.season_id]) {
      episodesBySeason[ep.season_id] = []
    }
    episodesBySeason[ep.season_id].push(ep)
  }

  return (
    <div>
      {/* Breadcrumb */}
      <nav className="text-sm text-muted-foreground mb-4">
        <Link href="/admin" className="hover:text-foreground transition-colors">
          Shows
        </Link>
        <span className="mx-2">&gt;</span>
        <span className="text-foreground">{show.title}</span>
      </nav>

      {/* Page header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold">{show.title}</h1>
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
