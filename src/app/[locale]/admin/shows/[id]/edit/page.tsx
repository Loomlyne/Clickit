import { getTranslations } from 'next-intl/server'
import Image from 'next/image'
import { Eye, Link2, Palette, Tags } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { ShowForm } from '@/components/admin/show-form'
import { AdminBackLink, AdminPanel } from '@/components/admin/admin-shell'
import { StatusBadge } from '@/components/admin/status-badge'
import { Button } from '@/components/ui/button'
import { Link } from '@/i18n/navigation'
import type { Database } from '@/lib/database.types'

type Show = Database['public']['Tables']['shows']['Row']
type Category = Database['public']['Tables']['categories']['Row']

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

function EditMediaPreview({ show, accent }: { show: Show; accent: string }) {
  const imageUrl = show.hero_url ?? show.poster_url ?? null

  return (
    <div className="relative overflow-hidden rounded-lg border border-white/10 bg-[#0f0f0f]">
      <div className="relative aspect-[16/9]">
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
            <Palette className="size-9 text-white/50" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
      </div>
    </div>
  )
}

function SelectedCategories({
  categories,
  emptyLabel,
}: {
  categories: Category[]
  emptyLabel: string
}) {
  if (categories.length === 0) {
    return <p className="text-muted-foreground text-sm">{emptyLabel}</p>
  }

  return (
    <div className="flex flex-wrap gap-2">
      {categories.map((category) => (
        <span
          key={category.id}
          className="text-muted-foreground rounded-full border border-white/8 bg-white/[0.03] px-3 py-1 text-xs"
        >
          {category.name_en}
        </span>
      ))}
    </div>
  )
}

export default async function EditShowPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>
}) {
  const { locale, id } = await params
  const supabase = await createClient()

  const [showResult, categoriesResult, showCategoriesResult, tEdit] =
    await Promise.all([
      supabase.from('shows').select('*').eq('id', id).single(),
      supabase
        .from('categories')
        .select('*')
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true }),
      supabase.from('show_categories').select('category_id').eq('show_id', id),
      getTranslations('admin.editShow'),
    ])

  if (showResult.error && showResult.error.code !== 'PGRST116') {
    throw showResult.error
  }
  const show = showResult.data
  if (!show) notFound()

  if (categoriesResult.error) throw categoriesResult.error
  if (showCategoriesResult.error) throw showCategoriesResult.error

  const categories = categoriesResult.data ?? []
  const selectedCategoryIds = (showCategoriesResult.data ?? []).map(
    (row) => row.category_id
  )
  const selectedCategories = categories.filter((category) =>
    selectedCategoryIds.includes(category.id)
  )
  const accent = getBrandAccent(show)
  const publicUrl = `/${locale}/series/${show.slug}`

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <AdminBackLink href={`/admin/shows/${id}`}>
          {tEdit('backToShow', { title: show.title })}
        </AdminBackLink>
        <Button variant="outline" size="sm" asChild>
          <Link href={`/admin/shows/${id}`}>
            <Eye className="me-1.5 size-4" />
            {tEdit('viewShow')}
          </Link>
        </Button>
      </div>

      <AdminPanel className="relative overflow-hidden border-[#2e2e2e] bg-[#171717] p-0">
        <div
          aria-hidden
          className="absolute inset-x-0 top-0 h-1"
          style={{ backgroundColor: accent }}
        />
        <div
          aria-hidden
          className="absolute -end-20 -top-20 size-56 rounded-full blur-3xl"
          style={{ backgroundColor: `${accent}2e` }}
        />
        <div className="relative grid gap-6 p-5 md:p-8 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="min-w-0">
            <p className="text-muted-foreground text-xs tracking-[0.24em] uppercase">
              {tEdit('eyebrow')}
            </p>
            <h1 className="text-foreground mt-3 text-4xl leading-none font-medium tracking-tight md:text-5xl">
              {tEdit('title')}
            </h1>
            <p className="text-muted-foreground mt-3 max-w-2xl text-sm leading-6 md:text-base">
              {tEdit('description', { title: show.title })}
            </p>
            <div className="mt-5 flex flex-wrap items-center gap-2">
              <StatusBadge status={show.status} />
              <span className="text-muted-foreground rounded-full border border-white/8 bg-[#0f0f0f] px-3 py-1 text-xs">
                {show.genre}
              </span>
            </div>
          </div>
          <EditMediaPreview show={show} accent={accent} />
        </div>
      </AdminPanel>

      <div className="grid gap-5 xl:grid-cols-[340px_minmax(0,1fr)]">
        <aside className="space-y-5 xl:sticky xl:top-24 xl:self-start">
          <AdminPanel className="border-[#2e2e2e] bg-[#171717] p-5">
            <div className="text-muted-foreground flex items-center gap-2">
              <Link2 className="size-4" />
              <span className="text-[11px] tracking-[0.18em] uppercase">
                {tEdit('publicUrlLabel')}
              </span>
            </div>
            <p className="text-foreground mt-3 rounded-lg border border-white/8 bg-[#0f0f0f] px-3 py-2 text-sm break-words">
              {publicUrl}
            </p>
            <p className="text-muted-foreground mt-3 text-xs leading-5">
              {tEdit('publicUrlHint')}
            </p>
          </AdminPanel>

          <AdminPanel className="border-[#2e2e2e] bg-[#171717] p-5">
            <div className="text-muted-foreground flex items-center gap-2">
              <Tags className="size-4" />
              <span className="text-[11px] tracking-[0.18em] uppercase">
                {tEdit('connectedCategories')}
              </span>
            </div>
            <div className="mt-4">
              <SelectedCategories
                categories={selectedCategories}
                emptyLabel={tEdit('noCategories')}
              />
            </div>
          </AdminPanel>
        </aside>

        <ShowForm
          show={show}
          categories={categories}
          initialCategoryIds={selectedCategoryIds}
        />
      </div>
    </div>
  )
}
