'use client'

import { useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { Plus, Pencil } from 'lucide-react'
import { useRouter } from '@/i18n/navigation'

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
import { ImportPlaylistSheet } from '@/components/admin/import-playlist-sheet'
import { RenumberSeasonDialog } from '@/components/admin/renumber-season-dialog'
import { AdminPanel } from '@/components/admin/admin-shell'
import {
  createSeason,
  updateSeason,
  createEpisode,
} from '@/app/[locale]/admin/actions'
import type { Database } from '@/lib/database.types'
import { useRowVersions } from '@/components/admin/row-version'
import { formatNumberList } from '@/lib/i18n-format'
import { planRenumber } from '@/lib/admin/renumber-plan'

type Season = Database['public']['Tables']['seasons']['Row']
type Episode = Database['public']['Tables']['episodes']['Row']

type ShowDefaults = {
  title: string
  title_ar: string | null
  description: string
  description_ar: string | null
}

interface SeasonTabsProps {
  seasons: Season[]
  episodesBySeason: Record<string, Episode[]>
  maxEpisodeNumberBySeason: Record<string, number>
  showId: string
  showDefaults: ShowDefaults
}

function getSeasonTitle(season: Season, isArabic: boolean) {
  return isArabic && season.title_ar ? season.title_ar : season.title
}

export function SeasonTabs({
  seasons,
  episodesBySeason,
  maxEpisodeNumberBySeason,
  showId,
  showDefaults,
}: SeasonTabsProps) {
  const router = useRouter()
  const locale = useLocale()
  const isArabic = locale === 'ar'
  const tSeason = useTranslations('admin.seasonForm')
  const tEpisode = useTranslations('admin.episodeForm')
  const t = useTranslations('admin.seasonTabs')
  const tTable = useTranslations('admin.episodesTable')
  const [seasonDrawerOpen, setSeasonDrawerOpen] = useState(false)
  const [editSeason, setEditSeason] = useState<Season | null>(null)
  // A season save lands only while the row still holds the updated_at it was opened with (item 8).
  const seasonVersions = useRowVersions()
  const [episodeDrawerOpen, setEpisodeDrawerOpen] = useState(false)
  const [activeSeasonIdForEpisode, setActiveSeasonIdForEpisode] = useState<
    string | null
  >(null)

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
          heading={t('emptyHeading')}
          body={t('empty')}
          action={
            <div className="flex flex-wrap items-center justify-center gap-2">
              <Button
                className="min-h-11 px-6 py-2 text-sm font-bold"
                onClick={handleAddSeason}
              >
                <Plus className="me-1.5 size-4" />
                {tSeason('addSeason')}
              </Button>
              <ImportPlaylistSheet
                showId={showId}
                seasons={[]}
                nextSeasonNumber={1}
                trigger="outline"
              />
            </div>
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
        <TabsList className="h-auto! flex-wrap justify-start gap-2 rounded-full p-1.5">
          {seasons.map((season) => {
            const epCount = episodesBySeason[season.id]?.length ?? 0
            const title = getSeasonTitle(season, isArabic)
            return (
              <TabsTrigger
                key={season.id}
                value={season.id}
                className="h-9! gap-2 px-3.5 max-md:h-11!"
              >
                <span className="text-muted-foreground text-xs">
                  {t('seasonNumber', { number: season.season_number })}
                </span>
                <span>{title}</span>
                <span className="rounded-full bg-[var(--bg-3)] px-2 py-0.5 text-[12px] text-[var(--text-dim)]">
                  {epCount}
                </span>
              </TabsTrigger>
            )
          })}
        </TabsList>

        {seasons.map((season) => {
          const seasonEpisodes = episodesBySeason[season.id] ?? []
          const title = getSeasonTitle(season, isArabic)
          const renumberPlan = planRenumber(seasonEpisodes)
          return (
            <TabsContent key={season.id} value={season.id}>
              <AdminPanel className="space-y-4 p-4 md:p-5">
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                  <div>
                    <p className="text-[11px] font-semibold tracking-[0.12em] text-[var(--text-mute)] uppercase">
                      {t('seasonNumber', { number: season.season_number })}
                    </p>
                    <h3 className="mt-1 text-[16px] font-semibold text-[var(--text)]">
                      {title}
                    </h3>
                    {season.title_ar && !isArabic && (
                      <p
                        dir="rtl"
                        className="text-muted-foreground mt-1 text-sm"
                      >
                        {season.title_ar}
                      </p>
                    )}
                    <p className="text-muted-foreground mt-3 text-sm">
                      {t('episodeCount', { count: seasonEpisodes.length })}
                      {renumberPlan.needed && (
                        <span className="ms-2 text-[11px] text-[var(--text-mute)]">
                          {tTable('gapsHint', {
                            numbers: formatNumberList(
                              renumberPlan.numbers,
                              locale
                            ),
                          })}
                        </span>
                      )}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <RenumberSeasonDialog
                      showId={showId}
                      seasonId={season.id}
                      episodes={seasonEpisodes}
                    />
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="outline"
                          className="min-h-11 px-6 py-2 text-sm font-bold"
                          onClick={() => handleEditSeason(season)}
                          aria-label={t('editSeasonAria', {
                            title: season.title,
                          })}
                        >
                          <Pencil className="size-4" />
                          {t('editSeasonButton')}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>{t('editSeasonTooltip')}</TooltipContent>
                    </Tooltip>
                    <Button
                      className="min-h-11 px-6 py-2 text-sm font-bold"
                      onClick={() => handleAddEpisode(season.id)}
                    >
                      <Plus className="size-4" />
                      {tEpisode('addEpisode')}
                    </Button>
                  </div>
                </div>

                <EpisodesTable
                  episodes={seasonEpisodes}
                  showId={showId}
                  seasonId={season.id}
                  showDefaults={showDefaults}
                  nextEpisodeNumber={
                    (maxEpisodeNumberBySeason[season.id] ?? 0) + 1
                  }
                />
              </AdminPanel>
            </TabsContent>
          )
        })}
      </Tabs>

      <SeasonFormDrawer
        open={seasonDrawerOpen}
        onOpenChange={setSeasonDrawerOpen}
        season={editSeason}
        showId={showId}
        nextSeasonNumber={seasons.length + 1}
        onSave={async (data) => {
          if (editSeason) {
            const expected = seasonVersions.expected(editSeason.id, editSeason.updated_at)
            const result = await updateSeason(
              editSeason.id,
              { ...data, show_id: showId },
              expected
            )
            seasonVersions.saved(editSeason.id, expected, result.updatedAt)
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
          showDefaults={showDefaults}
          nextEpisodeNumber={
            (maxEpisodeNumberBySeason[activeSeasonIdForEpisode] ?? 0) + 1
          }
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
