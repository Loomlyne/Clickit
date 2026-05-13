import { getTranslations } from 'next-intl/server'
import Image from 'next/image'
import type { ReactNode } from 'react'
import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { CalendarClock, DatabaseIcon, Film, Link2, Layers3 } from 'lucide-react'
import { StatusBadge } from '@/components/admin/status-badge'
import { SeasonTabs } from '@/components/admin/season-tabs'
import { EditShowButton } from '@/components/admin/edit-show-button'
import { CastEditor } from '@/components/admin/cast-editor'
import { AdminBackLink, AdminPanel } from '@/components/admin/admin-shell'
import { AdminCategoryBadge } from '@/components/admin/admin-category-badge'
import type { Database } from '@/lib/database.types'

type Episode = Database['public']['Tables']['episodes']['Row']
type Show = Database['public']['Tables']['shows']['Row']
type CategoryJoin = { name_en: string; slug: string; color: string | null }
type ShowCategoryRow = Pick<
  Database['public']['Tables']['show_categories']['Row'],
  'category_id'
> & {
  categories: CategoryJoin | CategoryJoin[] | null
}

const brandAccentByColor: Record<string, string> = {
  'brand-blue': '#2C3569',
  'brand-purple': '#9F54A0',
  'brand-green': '#50A258',
  'brand-red': '#DB3F34',
  'brand-orange': '#EA8C2E',
}

function getBrandAccent(show: Show) {
  return brandAccentByColor[show.brand_color] ?? '#6073FF'
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-white/8 bg-[#171717]/80 p-4">
      <p className="text-muted-foreground text-[11px] tracking-[0.18em] uppercase">
        {label}
      </p>
      <p className="text-foreground mt-3 text-2xl font-medium tracking-tight">
        {value}
      </p>
    </div>
  )
}

function DetailTile({
  icon,
  label,
  value,
}: {
  icon: ReactNode
  label: string
  value: string
}) {
  return (
    <div className="rounded-lg border border-white/8 bg-[#171717]/70 p-4">
      <div className="text-muted-foreground flex items-center gap-2">
        {icon}
        <span className="text-[11px] tracking-[0.18em] uppercase">{label}</span>
      </div>
      <p className="text-foreground mt-3 text-sm break-words">{value}</p>
    </div>
  )
}

function MediaFrame({
  show,
  accent,
  label,
}: {
  show: Show
  accent: string
  label: string
}) {
  const imageUrl = show.hero_url ?? show.poster_url ?? null

  return (
    <div className="relative overflow-hidden rounded-lg border border-white/10 bg-[#0f0f0f]">
      <div className="relative aspect-[16/10]">
        {imageUrl ? (
          <Image
            src={imageUrl}
            alt={show.title}
            fill
            sizes="(min-width: 1280px) 360px, 100vw"
            className="object-cover"
            priority
          />
        ) : (
          <div
            className="flex h-full items-center justify-center"
            style={{ backgroundColor: `${accent}24` }}
          >
            <Film className="size-10 text-white/50" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
      </div>
      <div className="flex items-center justify-between border-t border-white/8 px-4 py-3">
        <span className="text-muted-foreground text-xs">{label}</span>
        <span
          className="size-2 rounded-full"
          style={{ backgroundColor: accent }}
        />
      </div>
    </div>
  )
}

export default async function ShowDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>
}) {
  const { locale, id } = await params
  const supabase = await createClient()
  const [tDash, tShows] = await Promise.all([
    getTranslations('admin.dashboard'),
    getTranslations('admin.shows'),
  ])

  const { data: show, error: showError } = await supabase
    .from('shows')
    .select('*')
    .eq('id', id)
    .single()

  if (showError && showError.code !== 'PGRST116') throw showError
  if (!show) notFound()

  const [
    seasonsResult,
    episodesResult,
    allEpisodesResult,
    castMembersResult,
    showCategoriesResult,
  ] = await Promise.all([
    supabase
      .from('seasons')
      .select('*')
      .eq('show_id', id)
      .order('season_number', { ascending: true }),
    supabase
      .from('episodes')
      .select('*')
      .eq('show_id', id)
      .eq('archived', false)
      .order('episode_number', { ascending: true }),
    supabase
      .from('episodes')
      .select('season_id, episode_number')
      .eq('show_id', id),
    supabase
      .from('show_cast')
      .select('*')
      .eq('show_id', id)
      .order('sort_order', { ascending: true }),
    supabase
      .from('show_categories')
      .select('category_id, categories!inner(name_en, slug, color)')
      .eq('show_id', id),
  ])

  for (const result of [
    seasonsResult,
    episodesResult,
    allEpisodesResult,
    castMembersResult,
    showCategoriesResult,
  ]) {
    if (result.error) throw result.error
  }

  const seasons = seasonsResult.data ?? []
  const episodes = episodesResult.data ?? []
  const allEpisodes = allEpisodesResult.data ?? []
  const castMembers = castMembersResult.data ?? []
  const showCategories = showCategoriesResult.data as ShowCategoryRow[] | null

  const categories = (showCategories ?? []).flatMap((row) => {
    const category = Array.isArray(row.categories)
      ? row.categories[0]
      : row.categories
    return category
      ? [
          {
            id: row.category_id,
            name: category.name_en,
            slug: category.slug,
            color: category.color ?? null,
          },
        ]
      : []
  })

  const episodesBySeason: Record<string, Episode[]> = {}
  for (const ep of episodes) {
    if (!episodesBySeason[ep.season_id]) {
      episodesBySeason[ep.season_id] = []
    }
    episodesBySeason[ep.season_id].push(ep)
  }

  const maxEpisodeNumberBySeason: Record<string, number> = {}
  for (const ep of allEpisodes) {
    const current = maxEpisodeNumberBySeason[ep.season_id] ?? 0
    if (ep.episode_number > current) {
      maxEpisodeNumberBySeason[ep.season_id] = ep.episode_number
    }
  }

  const accent = getBrandAccent(show)
  const broadcast = show.broadcast_day
    ? [show.broadcast_day, show.broadcast_time].filter(Boolean).join(', ')
    : tShows('notScheduled')
  const publicUrl = `/${locale}/series/${show.slug}`
  const dateFormatter = new Intl.DateTimeFormat(locale, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <AdminBackLink href="/admin">{tDash('allShows')}</AdminBackLink>
        <EditShowButton show={show} />
      </div>

      <AdminPanel className="relative overflow-hidden border-[#2e2e2e] bg-[#171717] p-0">
        <div
          aria-hidden
          className="absolute inset-x-0 top-0 h-1"
          style={{ backgroundColor: accent }}
        />
        <div
          aria-hidden
          className="absolute -end-24 -top-24 size-64 rounded-full blur-3xl"
          style={{ backgroundColor: `${accent}33` }}
        />
        <div className="relative grid gap-8 p-5 md:p-8 xl:grid-cols-[minmax(0,1fr)_380px]">
          <div className="min-w-0">
            <p className="text-muted-foreground text-xs tracking-[0.24em] uppercase">
              {tShows('showWorkspace')}
            </p>
            <h1 className="text-foreground mt-3 text-4xl leading-none font-medium tracking-tight md:text-6xl">
              {show.title}
            </h1>
            {show.title_ar && (
              <p
                dir="rtl"
                className="text-muted-foreground mt-3 text-xl font-medium tracking-tight"
              >
                {show.title_ar}
              </p>
            )}

            <div className="mt-5 flex flex-wrap items-center gap-2">
              <StatusBadge status={show.status} />
              <span className="text-muted-foreground rounded-full border border-white/8 bg-[#0f0f0f] px-3 py-1 text-xs">
                {show.genre}
              </span>
              <span className="text-muted-foreground rounded-full border border-white/8 bg-[#0f0f0f] px-3 py-1 text-xs">
                {broadcast}
              </span>
            </div>

            {categories.length > 0 && (
              <div className="mt-5">
                <p className="text-muted-foreground mb-2 text-[11px] tracking-[0.18em] uppercase">
                  {tShows('categoriesLabel')}
                </p>
                <div className="flex flex-wrap gap-2">
                  {categories.map((category) => (
                    <AdminCategoryBadge
                      key={category.id}
                      name={category.name}
                      color={category.color}
                    />
                  ))}
                </div>
              </div>
            )}

            <div className="mt-6 max-w-4xl space-y-3">
              <p className="text-muted-foreground text-[11px] tracking-[0.18em] uppercase">
                {tShows('descriptionLabel')}
              </p>
              <p className="text-muted-foreground text-sm leading-7 md:text-base">
                {show.description}
              </p>
              {show.description_ar && (
                <p
                  dir="rtl"
                  className="text-muted-foreground text-sm leading-7 md:text-base"
                >
                  {show.description_ar}
                </p>
              )}
            </div>

            <div className="mt-6 grid gap-3 md:grid-cols-3">
              <DetailTile
                icon={<Link2 className="size-4" />}
                label={tShows('urlLabel')}
                value={publicUrl}
              />
              <DetailTile
                icon={<CalendarClock className="size-4" />}
                label={tShows('updatedLabel')}
                value={dateFormatter.format(new Date(show.updated_at))}
              />
              <DetailTile
                icon={<DatabaseIcon className="size-4" />}
                label={tShows('supabaseLabel')}
                value={show.id}
              />
            </div>
          </div>

          <div className="grid content-start gap-3 sm:grid-cols-3 xl:grid-cols-1">
            <div className="sm:col-span-3 xl:col-span-1">
              <MediaFrame
                show={show}
                accent={accent}
                label={tShows('supabaseMediaLabel')}
              />
            </div>
            <StatCard label={tShows('seasonsStat')} value={seasons.length} />
            <StatCard
              label={tShows('episodesStat')}
              value={show.episode_count}
            />
            <StatCard label={tShows('broadcast')} value={broadcast} />
          </div>
        </div>
      </AdminPanel>

      <AdminPanel className="border-[#2e2e2e] bg-[#171717] p-5 md:p-6">
        <div className="mb-5 flex items-center gap-3">
          <div className="text-foreground rounded-lg border border-white/8 bg-[#0f0f0f] p-2">
            <Layers3 className="size-4" />
          </div>
          <div>
            <p className="text-muted-foreground text-xs tracking-[0.2em] uppercase">
              {tShows('contentLabel')}
            </p>
            <h2 className="text-foreground mt-1 text-xl font-medium tracking-tight">
              {tShows('castEpisodesLabel')}
            </h2>
          </div>
        </div>
        <CastEditor showId={id} cast={castMembers} />
      </AdminPanel>

      <SeasonTabs
        seasons={seasons}
        episodesBySeason={episodesBySeason}
        maxEpisodeNumberBySeason={maxEpisodeNumberBySeason}
        showId={id}
      />
    </div>
  )
}
