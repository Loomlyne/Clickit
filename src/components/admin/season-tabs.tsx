'use client'

import { useState } from 'react'
import { Plus, Pencil } from 'lucide-react'
import { useRouter } from 'next/navigation'

import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { EpisodesTable } from '@/components/admin/episodes-table'
import { SeasonFormDrawer } from '@/components/admin/season-form-drawer'
import { EpisodeFormDrawer } from '@/components/admin/episode-form-drawer'
import { EmptyState } from '@/components/admin/empty-state'
import {
  createSeason,
  updateSeason,
  createEpisode,
} from '@/app/[locale]/admin/actions'
import type { Database } from '@/lib/database.types'

type Season = Database['public']['Tables']['seasons']['Row']
type Episode = Database['public']['Tables']['episodes']['Row']

interface SeasonTabsProps {
  seasons: Season[]
  episodesBySeason: Record<string, Episode[]>
  maxEpisodeNumberBySeason: Record<string, number>
  showId: string
}

export function SeasonTabs({ seasons, episodesBySeason, maxEpisodeNumberBySeason, showId }: SeasonTabsProps) {
  const router = useRouter()
  const [seasonDrawerOpen, setSeasonDrawerOpen] = useState(false)
  const [editSeason, setEditSeason] = useState<Season | null>(null)
  const [episodeDrawerOpen, setEpisodeDrawerOpen] = useState(false)
  const [activeSeasonIdForEpisode, setActiveSeasonIdForEpisode] = useState<string | null>(null)

  function handleAddSeason() {
    setEditSeason(null)
    setSeasonDrawerOpen(true)
  }

  function handleEditSeason(season: Season) {
    setEditSeason(season)
    setSeasonDrawerOpen(true)
  }

  function handleAddEpisode(seasonId: string) {
    setActiveSeasonIdForEpisode(seasonId)
    setEpisodeDrawerOpen(true)
  }

  if (seasons.length === 0) {
    return (
      <div>
        <EmptyState
          heading="No Seasons"
          body="Create a season to start adding episodes."
          action={
            <Button onClick={handleAddSeason}>
              <Plus className="mr-1.5 size-4" />
              Add Season
            </Button>
          }
        />
        <SeasonFormDrawer
          open={seasonDrawerOpen}
          onOpenChange={setSeasonDrawerOpen}
          season={null}
          showId={showId}
          nextSeasonNumber={1}
          onSave={async (data) => {
            const result = await createSeason({ ...data, show_id: showId })
            if (result.success) router.refresh()
            return result
          }}
        />
      </div>
    )
  }

  const defaultTab = seasons[0].id

  return (
    <TooltipProvider delayDuration={300}>
      <Tabs defaultValue={defaultTab} className="space-y-4">
        <div className="rounded-[28px] border border-white/10 bg-white/[0.04] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.24)] md:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">
                Seasons
              </p>
              <h2 className="mt-2 text-xl font-semibold tracking-tight text-foreground">
                Episode management
              </h2>
            </div>
            <Button variant="outline" size="sm" onClick={handleAddSeason}>
              <Plus className="mr-1 size-4" />
              Add Season
            </Button>
          </div>

          <div className="mt-5 overflow-x-auto">
            <TabsList>
            {seasons.map((season) => {
              const epCount = episodesBySeason[season.id]?.length ?? 0
              return (
                <TabsTrigger key={season.id} value={season.id} className="gap-1.5">
                  {season.title}
                  <span className="text-xs text-muted-foreground">({epCount})</span>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleEditSeason(season)
                        }}
                        className="ml-0.5 rounded p-0.5 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                        aria-label={`Edit ${season.title}`}
                      >
                        <Pencil className="size-3" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>Edit season</TooltipContent>
                  </Tooltip>
                </TabsTrigger>
              )
            })}
            </TabsList>
          </div>
        </div>

        {seasons.map((season) => {
          const seasonEpisodes = episodesBySeason[season.id] ?? []
          return (
            <TabsContent key={season.id} value={season.id}>
              <div className="rounded-[28px] border border-white/10 bg-white/[0.04] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.24)] md:p-6">
                <div className="mb-4 flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">
                    {seasonEpisodes.length} episode{seasonEpisodes.length !== 1 ? 's' : ''}
                  </p>
                  <Button size="sm" onClick={() => handleAddEpisode(season.id)}>
                    <Plus className="mr-1 size-4" />
                    Add Episode
                  </Button>
                </div>
                <EpisodesTable
                  episodes={seasonEpisodes}
                  showId={showId}
                  seasonId={season.id}
                  nextEpisodeNumber={(maxEpisodeNumberBySeason[season.id] ?? 0) + 1}
                />
              </div>
            </TabsContent>
          )
        })}
      </Tabs>

      {/* Season Form Drawer */}
      <SeasonFormDrawer
        open={seasonDrawerOpen}
        onOpenChange={setSeasonDrawerOpen}
        season={editSeason}
        showId={showId}
        nextSeasonNumber={seasons.length + 1}
        onSave={async (data) => {
          if (editSeason) {
            const result = await updateSeason(editSeason.id, { ...data, show_id: showId })
            if (result.success) router.refresh()
            return result
          }
          const result = await createSeason({ ...data, show_id: showId })
          if (result.success) router.refresh()
          return result
        }}
      />

      {activeSeasonIdForEpisode && (
        <EpisodeFormDrawer
          open={episodeDrawerOpen}
          onOpenChange={setEpisodeDrawerOpen}
          episode={null}
          showId={showId}
          seasonId={activeSeasonIdForEpisode}
          nextEpisodeNumber={(maxEpisodeNumberBySeason[activeSeasonIdForEpisode] ?? 0) + 1}
          onSave={async (data) => {
            const result = await createEpisode({
              ...data,
              show_id: showId,
              season_id: activeSeasonIdForEpisode,
            })
            if (result.success) router.refresh()
            return result
          }}
        />
      )}
    </TooltipProvider>
  )
}
