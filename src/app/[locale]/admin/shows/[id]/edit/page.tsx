import { getTranslations } from 'next-intl/server'
import Image from 'next/image'
import { Eye, Palette } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { ShowForm } from '@/components/admin/show-form'
import { AdminBackLink } from '@/components/admin/admin-shell'
import { StatusBadge } from '@/components/admin/status-badge'
import { Button } from '@/components/ui/button'
import { Link } from '@/i18n/navigation'
import type { Database } from '@/lib/database.types'
import { stripStorageCacheBust } from '@/lib/supabase-media'
import { BRAND_COLOR_HEX, NEUTRAL_ACCENT_HEX } from '@/lib/brand-colors'

type Show = Database['public']['Tables']['shows']['Row']

function getBrandAccent(show: Show) {
  return BRAND_COLOR_HEX[show.brand_color as keyof typeof BRAND_COLOR_HEX] ?? NEUTRAL_ACCENT_HEX
}

function EditMediaPreview({ show, accent }: { show: Show; accent: string }) {
  const sourceImageUrl =
    show.card_image_url ?? show.hero_url ?? show.poster_url ?? null
  const imageUrl = stripStorageCacheBust(sourceImageUrl) ?? sourceImageUrl

  return (
    <div className="relative w-28 shrink-0 overflow-hidden rounded-lg border border-[var(--line)] bg-[var(--bg-0)] md:w-36">
      <div className="relative aspect-[16/9]">
        {imageUrl ? (
          <Image
            src={imageUrl}
            alt={show.title}
            fill
            sizes="144px"
            className="object-cover"
            priority
          />
        ) : (
          <div
            className="flex h-full items-center justify-center"
            style={{ backgroundColor: `${accent}24` }}
          >
            <Palette className="size-6 text-[var(--text-mute)]" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
      </div>
    </div>
  )
}

export default async function EditShowPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>
}) {
  const { id } = await params
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
  const accent = getBrandAccent(show)

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <AdminBackLink href={`/admin/shows/${id}`}>
          {tEdit('backToShow', { title: show.title })}
        </AdminBackLink>
        <Button variant="outline" size="sm" asChild>
          <Link href={`/admin/shows/${id}`}>
            <Eye className="size-4" />
            {tEdit('viewShow')}
          </Link>
        </Button>
      </div>

      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex min-w-0 items-center gap-4">
          <EditMediaPreview show={show} accent={accent} />
          <div className="min-w-0">
            <div
              aria-hidden
              className="mb-1.5 h-1 w-10 rounded-full"
              style={{ backgroundColor: accent }}
            />
            <h1 className="text-[24px] leading-8 font-semibold tracking-tight text-[var(--text)]">
              {tEdit('title')}
            </h1>
            <p className="mt-0.5 max-w-2xl text-[14px] leading-6 text-[var(--text-dim)]">
              {tEdit('description', { title: show.title })}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <StatusBadge status={show.status} />
              <span className="rounded-full border border-[var(--line)] bg-[var(--bg-2)] px-2.5 py-0.5 text-[12px] text-[var(--text-dim)]">
                {show.genre}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div>
        <ShowForm
          show={show}
          categories={categories}
          initialCategoryIds={selectedCategoryIds}
        />
      </div>
    </div>
  )
}
