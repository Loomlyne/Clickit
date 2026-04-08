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

  // Fetch ALL episodes (including archived) to compute correct max episode_number per season
  const { data: allEpisodes } = await supabase
    .from('episodes')
    .select('season_id, episode_number')
    .eq('show_id', id)

  const episodesBySeason: Record<string, Episode[]> = {}
  for (const ep of episodes ?? []) {
    if (!episodesBySeason[ep.season_id]) {
      episodesBySeason[ep.season_id] = []
    }
    episodesBySeason[ep.season_id].push(ep)
  }

  // Compute max episode_number per season across ALL episodes (including archived)
  const maxEpisodeNumberBySeason: Record<string, number> = {}
  for (const ep of allEpisodes ?? []) {
    const current = maxEpisodeNumberBySeason[ep.season_id] ?? 0
    if (ep.episode_number > current) {
      maxEpisodeNumberBySeason[ep.season_id] = ep.episode_number
    }
  }

  return (
    <div className="space-y-6">
      <Link
        href="/admin"
        className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        All Shows
      </Link>

      <div className="rounded-[28px] border border-white/10 bg-white/[0.04] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.28)] md:p-8">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">
              Show Detail
            </p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-foreground">
              {show.title}
            </h1>
            <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
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
            <p className="mt-4 max-w-3xl text-sm leading-7 text-muted-foreground md:text-base">
              {show.description}
            </p>
          </div>
          <div className="flex flex-col items-start gap-3 rounded-2xl border border-white/10 bg-black/20 px-4 py-4">
            <span className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
              Publishing state
            </span>
            <StatusBadge status={show.status} />
          </div>
        </div>
      </div>

      <SeasonTabs
        seasons={seasons ?? []}
        episodesBySeason={episodesBySeason}
        maxEpisodeNumberBySeason={maxEpisodeNumberBySeason}
        showId={id}
      />
    </div>
  )
}
