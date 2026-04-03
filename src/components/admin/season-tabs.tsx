'use client'

import { useState } from 'react'
import { Plus, Pencil } from 'lucide-react'
import { useRouter } from 'next/navigation'

import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { EpisodesTable } from '@/components/admin/episodes-table'
import { SeasonFormDrawer } from '@/components/admin/season-form-drawer'
import { EpisodeFormDrawer } from '@/components/admin/episode-form-drawer'
import { EmptyState } from '@/components/admin/empty-state'
import {
  createSeason,
  updateSeason,
  createEpisode,
} from '@/app/admin/actions'
import type { Database } from '@/lib/database.types'

type Season = Database['public']['Tables']['seasons']['Row']
type Episode = Database['public']['Tables']['episodes']['Row']

interface SeasonTabsProps {
  seasons: Season[]
  episodesBySeason: Record<string, Episode[]>
  showId: string
}

export function SeasonTabs({ seasons, episodesBySeason, showId }: SeasonTabsProps) {
  const router = useRouter()

  // Season drawer state
  const [seasonDrawerOpen, setSeasonDrawerOpen] = useState(false)
  const [editSeason, setEditSeason] = useState<Season | null>(null)

  // Episode drawer state
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
              <Plus className="mr-2 size-4" />
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
            const result = await createSeason({
              ...data,
              show_id: showId,
            })
            if (result.success) router.refresh()
            return result
          }}
        />
      </div>
    )
  }

  const defaultTab = seasons[0].id

  return (
    <div>
      <Tabs defaultValue={defaultTab}>
        <div className="flex items-center gap-2 mb-4">
          <TabsList>
            {seasons.map((season) => (
              <TabsTrigger key={season.id} value={season.id} className="gap-1.5">
                {season.title}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    handleEditSeason(season)
                  }}
                  className="ml-1 rounded p-0.5 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-accent"
                  aria-label={`Edit ${season.title}`}
                >
                  <Pencil className="size-3" />
                </button>
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        {seasons.map((season) => {
          const seasonEpisodes = episodesBySeason[season.id] ?? []
          return (
            <TabsContent key={season.id} value={season.id}>
              <div className="flex items-center justify-end mb-4">
                <Button size="sm" onClick={() => handleAddEpisode(season.id)}>
                  <Plus className="mr-1 size-4" />
                  Add Episode
                </Button>
              </div>
              <EpisodesTable
                episodes={seasonEpisodes}
                showId={showId}
                seasonId={season.id}
              />
            </TabsContent>
          )
        })}
      </Tabs>

      {/* Add Season button below tabs */}
      <div className="mt-6">
        <Button variant="outline" onClick={handleAddSeason}>
          <Plus className="mr-1 size-4" />
          Add Season
        </Button>
      </div>

      {/* Season Form Drawer */}
      <SeasonFormDrawer
        open={seasonDrawerOpen}
        onOpenChange={setSeasonDrawerOpen}
        season={editSeason}
        showId={showId}
        nextSeasonNumber={seasons.length + 1}
        onSave={async (data) => {
          if (editSeason) {
            const result = await updateSeason(editSeason.id, {
              ...data,
              show_id: showId,
            })
            if (result.success) router.refresh()
            return result
          }
          const result = await createSeason({
            ...data,
            show_id: showId,
          })
          if (result.success) router.refresh()
          return result
        }}
      />

      {/* Episode Form Drawer (for Add Episode) */}
      {activeSeasonIdForEpisode && (
        <EpisodeFormDrawer
          open={episodeDrawerOpen}
          onOpenChange={setEpisodeDrawerOpen}
          episode={null}
          showId={showId}
          seasonId={activeSeasonIdForEpisode}
          nextEpisodeNumber={(episodesBySeason[activeSeasonIdForEpisode]?.length ?? 0) + 1}
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
    </div>
  )
}
