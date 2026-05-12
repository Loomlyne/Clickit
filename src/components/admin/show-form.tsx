'use client'

import { useEffect, useMemo } from 'react'
import { useTranslations } from 'next-intl'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { RefreshCw } from 'lucide-react'
import { useRouter } from '@/i18n/navigation'

import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { AdminPanel } from '@/components/admin/admin-shell'
import { ArtworkUploadZone } from '@/components/admin/artwork-upload-zone'
import { HeroMediaPicker } from '@/components/admin/hero-media-picker'
import { generateSlug } from '@/lib/slug'
import { createShow, updateShow } from '@/app/[locale]/admin/actions'
import type { Database } from '@/lib/database.types'

const showFormSchema = z.object({
  title: z.string().min(1, 'titleRequired'),
  title_ar: z.string().optional().nullable(),
  slug: z.string().min(1, 'slugRequired'),
  description: z.string().min(1, 'descriptionRequired'),
  description_ar: z.string().optional().nullable(),
  tagline: z.string().optional().nullable(),
  tagline_ar: z.string().optional().nullable(),
  genre: z.string().min(1, 'genreRequired'),
  brand_color: z.enum(['brand-blue', 'brand-purple', 'brand-green', 'brand-red', 'brand-orange']),
  status: z.enum(['draft', 'coming-soon', 'now-streaming']),
  broadcast_day: z.string().optional().nullable(),
  broadcast_time: z.string().optional().nullable(),
  poster_url: z.string().optional().nullable(),
  hero_url: z.string().optional().nullable(),
  logo_url: z.string().optional().nullable(),
  hero_image_mobile_url: z.string().optional().nullable(),
  hero_video_url: z.string().optional().nullable(),
  hero_video_type: z.enum(['mp4', 'youtube']).optional().nullable(),
  hero_video_mobile_url: z.string().optional().nullable(),
  hero_video_mobile_type: z.enum(['mp4', 'youtube']).optional().nullable(),
  category_ids: z.array(z.string().uuid()).default([]),
})

type ShowFormData = z.infer<typeof showFormSchema>
type DbShow = Database['public']['Tables']['shows']['Row']
type Category = Database['public']['Tables']['categories']['Row']

const BRAND_COLORS = [
  { value: 'brand-blue', key: 'colorBlue', hex: '#2C3569' },
  { value: 'brand-purple', key: 'colorPurple', hex: '#9F54A0' },
  { value: 'brand-green', key: 'colorGreen', hex: '#50A258' },
  { value: 'brand-red', key: 'colorRed', hex: '#DB3F34' },
  { value: 'brand-orange', key: 'colorOrange', hex: '#EA8C2E' },
]

const GENRES = [
  'Travel', 'Health', 'Music', 'Comedy', 'Cooking',
  'Kids', 'Poetry', 'Cinema', 'Tech', 'Entertainment', 'Culture',
]

const DAYS = [
  'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday',
]

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <AdminPanel className="p-6">
      <h3 className="mono mb-5 text-[var(--text-mute)]">{title}</h3>
      <div className="space-y-5">{children}</div>
    </AdminPanel>
  )
}

function Field({ label, required, error, children }: { label: string; required?: boolean; error?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm">
        {label}
        {required && <span className="text-red-400 ms-0.5">*</span>}
      </Label>
      {children}
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  )
}

function getFormDefaults(show: DbShow | null, categoryIds: string[]): ShowFormData {
  if (!show) {
    return {
      title: '', title_ar: '', slug: '', description: '', description_ar: '',
      tagline: '', tagline_ar: '', genre: '', brand_color: 'brand-blue',
      status: 'draft', broadcast_day: '', broadcast_time: '',
      poster_url: '', hero_url: '', logo_url: '',
      hero_image_mobile_url: '', hero_video_url: '', hero_video_type: null,
      hero_video_mobile_url: '', hero_video_mobile_type: null,
      category_ids: categoryIds,
    }
  }
  return {
    title: show.title, title_ar: show.title_ar ?? '', slug: show.slug,
    description: show.description, description_ar: show.description_ar ?? '',
    tagline: show.tagline ?? '', tagline_ar: show.tagline_ar ?? '',
    genre: show.genre, brand_color: show.brand_color as ShowFormData['brand_color'],
    status: show.status as ShowFormData['status'],
    broadcast_day: show.broadcast_day ?? '', broadcast_time: show.broadcast_time ?? '',
    poster_url: show.poster_url ?? '', hero_url: show.hero_url ?? '',
    logo_url: show.logo_url ?? '',
    hero_image_mobile_url: show.hero_image_mobile_url ?? '',
    hero_video_url: show.hero_video_url ?? '',
    hero_video_type: (show.hero_video_type as 'mp4' | 'youtube' | null) ?? null,
    hero_video_mobile_url: show.hero_video_mobile_url ?? '',
    hero_video_mobile_type: (show.hero_video_mobile_type as 'mp4' | 'youtube' | null) ?? null,
    category_ids: categoryIds,
  }
}

interface ShowFormProps {
  show?: DbShow | null
  categories: Category[]
  initialCategoryIds?: string[]
}

export function ShowForm({ show, categories, initialCategoryIds = [] }: ShowFormProps) {
  const isEdit = !!show
  const router = useRouter()
  const t = useTranslations('admin.showForm')
  const tCommon = useTranslations('common')
  const tErrors = useTranslations('errors')

  const generatedId = useMemo(() => {
    if (isEdit) return show.id
    return crypto.randomUUID()
  }, [isEdit, show?.id])

  const form = useForm<ShowFormData>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(showFormSchema) as any,
    defaultValues: getFormDefaults(show ?? null, initialCategoryIds),
  })

  const watchedTitle = form.watch('title')
  useEffect(() => {
    if (!isEdit && watchedTitle) {
      form.setValue(
        'slug',
        generateSlug(watchedTitle, `show-${generatedId.slice(0, 8)}`)
      )
    }
  }, [watchedTitle, isEdit, form, generatedId])

  function regenerateSlug() {
    const title = form.getValues('title')
    const id = isEdit ? show.id : generatedId
    form.setValue(
      'slug',
      generateSlug(title ?? '', `show-${id.slice(0, 8)}`),
      { shouldDirty: true, shouldValidate: true }
    )
  }

  async function onSubmit(data: ShowFormData) {
    const normalized: ShowFormData & { id?: string } = {
      ...data,
      title_ar: data.title_ar || null, description_ar: data.description_ar || null,
      tagline: data.tagline || null, tagline_ar: data.tagline_ar || null,
      broadcast_day: data.broadcast_day || null, broadcast_time: data.broadcast_time || null,
      poster_url: data.poster_url || null, hero_url: data.hero_url || null,
      logo_url: data.logo_url || null,
      hero_image_mobile_url: data.hero_image_mobile_url || null,
      hero_video_url: data.hero_video_url || null,
      hero_video_type: data.hero_video_type || null,
      hero_video_mobile_url: data.hero_video_mobile_url || null,
      hero_video_mobile_type: data.hero_video_mobile_type || null,
      category_ids: data.category_ids,
    }
    if (!isEdit) normalized.id = generatedId

    const result = isEdit
      ? await updateShow(show.id, normalized)
      : await createShow(normalized)

    if (result.success) {
      toast.success(isEdit ? t('showUpdated') : t('showCreated'))
      router.push(isEdit ? `/admin/shows/${show.id}` : '/admin')
    } else {
      toast.error(result.error || t('toastSaveFailed'))
    }
  }

  const errors = form.formState.errors
  const selectedCategoryIds = form.watch('category_ids')

  function toggleCategory(categoryId: string, checked: boolean) {
    const next = checked
      ? [...new Set([...selectedCategoryIds, categoryId])]
      : selectedCategoryIds.filter((id) => id !== categoryId)
    form.setValue('category_ids', next, { shouldDirty: true })
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
      <Section title={t('basicInfoTab')}>
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          <Field label={t('titleLabel')} required error={errors.title?.message ? tErrors(errors.title.message as never) : undefined}>
            <Input {...form.register('title')} placeholder="e.g., Last Call" />
          </Field>
          <Field label={t('titleArLabel')}>
            <Input dir="rtl" {...form.register('title_ar')} />
          </Field>
        </div>

        <Field label={t('slugLabel')} required error={errors.slug?.message ? tErrors(errors.slug.message as never) : undefined}>
          <div className="flex gap-2">
            <Input {...form.register('slug')} className="flex-1" />
            <button
              type="button"
              onClick={regenerateSlug}
              className="inline-flex items-center gap-1.5 rounded-md border border-input bg-background px-3 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground"
              title={t('regenerateSlugTitle')}
            >
              <RefreshCw className="size-3.5" /> {t('regenerateSlug')}
            </button>
          </div>
          <p className="text-xs text-muted-foreground mt-1">{t('slugHint')}</p>
        </Field>

        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          <Field label={t('genreLabel')} required error={errors.genre?.message ? tErrors(errors.genre.message as never) : undefined}>
            <Select
              value={form.watch('genre')}
              onValueChange={(val) => form.setValue('genre', val, { shouldValidate: true })}
            >
              <SelectTrigger><SelectValue placeholder={t('selectPlaceholder')} /></SelectTrigger>
              <SelectContent>
                {GENRES.map((g) => <SelectItem key={g} value={g}>{t(`genre${g}` as never)}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field label={t('statusLabel')} required>
            <Select
              value={form.watch('status')}
              onValueChange={(val) => form.setValue('status', val as ShowFormData['status'], { shouldValidate: true })}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="draft">{t('statusDraft')}</SelectItem>
                <SelectItem value="coming-soon">{t('statusComingSoon')}</SelectItem>
                <SelectItem value="now-streaming">{t('statusNowStreaming')}</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        </div>

        <Field label={t('categoriesLabel')}>
          {categories.length === 0 ? (
            <div className="rounded-lg border border-dashed border-white/12 px-4 py-3 text-sm text-muted-foreground">
              {t('categoriesEmpty')}
            </div>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              {categories.map((category) => {
                const checked = selectedCategoryIds.includes(category.id)
                return (
                  <label
                    key={category.id}
                    className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border border-white/8 bg-white/[0.02] px-3 py-2.5 transition-colors hover:border-white/16"
                  >
                    <Checkbox
                      checked={checked}
                      onCheckedChange={(value) => toggleCategory(category.id, value === true)}
                    />
                    <div className="min-w-0">
                      <div className="text-sm text-foreground">{category.name_en}</div>
                      <div className="text-xs text-muted-foreground">{category.slug}</div>
                    </div>
                  </label>
                )
              })}
            </div>
          )}
        </Field>
      </Section>

      <Section title={t('descriptionSection')}>
        <Field label={t('descriptionLabel')} required error={errors.description?.message ? tErrors(errors.description.message as never) : undefined}>
          <Textarea rows={4} {...form.register('description')} placeholder={t('descriptionPlaceholder')} />
        </Field>
        <Field label={t('descriptionArLabel')}>
          <Textarea rows={4} dir="rtl" {...form.register('description_ar')} />
        </Field>
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          <Field label={t('taglineLabel')}>
            <Input {...form.register('tagline')} placeholder={t('taglinePlaceholder')} />
          </Field>
          <Field label={t('taglineArLabel')}>
            <Input dir="rtl" {...form.register('tagline_ar')} />
          </Field>
        </div>
      </Section>

      <Section title={t('brandingSection')}>
        <Field label={t('brandColorLabel')}>
          <div className="flex gap-2">
            {BRAND_COLORS.map((c) => (
              <button
                key={c.value}
                type="button"
                onClick={() => form.setValue('brand_color', c.value as ShowFormData['brand_color'])}
                className={`flex flex-col items-center gap-1 rounded-lg p-2 transition-all ${
                  form.watch('brand_color') === c.value
                    ? 'ring-2 ring-white bg-white/10'
                    : 'hover:bg-white/5'
                }`}
              >
                <span className="size-8 rounded-full" style={{ backgroundColor: c.hex }} />
                <span className="text-[10px] text-muted-foreground">{t(c.key as never)}</span>
              </button>
            ))}
          </div>
        </Field>

        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          <ArtworkUploadZone
            showId={generatedId} slot="poster"
            currentUrl={form.watch('poster_url') || null}
            onUploadComplete={(url) => form.setValue('poster_url', url)}
            onDelete={() => form.setValue('poster_url', '')}
            label={t('posterLabel')} aspectHint={t('posterAspectHint')}
          />
          <ArtworkUploadZone
            showId={generatedId} slot="logo"
            currentUrl={form.watch('logo_url') || null}
            onUploadComplete={(url) => form.setValue('logo_url', url)}
            onDelete={() => form.setValue('logo_url', '')}
            label={t('logoLabel')} aspectHint={t('logoAspectHint')}
          />
        </div>
      </Section>

      <Section title={t('heroMediaSection')}>
        <p className="text-xs text-muted-foreground -mt-2">
          {t('heroMediaHint')}
        </p>
        <HeroMediaPicker
          showId={generatedId}
          variant="desktop"
          currentImageUrl={form.watch('hero_url') || null}
          currentVideoUrl={form.watch('hero_video_url') || null}
          currentVideoType={form.watch('hero_video_type') ?? null}
          onImageChange={(url) => form.setValue('hero_url', url ?? '')}
          onVideoChange={(video) => {
            form.setValue('hero_video_url', video?.url ?? '')
            form.setValue('hero_video_type', video?.type ?? null)
          }}
        />
        <HeroMediaPicker
          showId={generatedId}
          variant="mobile"
          currentImageUrl={form.watch('hero_image_mobile_url') || null}
          currentVideoUrl={form.watch('hero_video_mobile_url') || null}
          currentVideoType={form.watch('hero_video_mobile_type') ?? null}
          onImageChange={(url) => form.setValue('hero_image_mobile_url', url ?? '')}
          onVideoChange={(video) => {
            form.setValue('hero_video_mobile_url', video?.url ?? '')
            form.setValue('hero_video_mobile_type', video?.type ?? null)
          }}
        />
      </Section>

      <Section title={t('scheduleSection')}>
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          <Field label={t('broadcastDayLabel')}>
            <Select
              value={form.watch('broadcast_day') ?? ''}
              onValueChange={(val) => form.setValue('broadcast_day', val || null)}
            >
              <SelectTrigger><SelectValue placeholder={t('selectDayPlaceholder')} /></SelectTrigger>
              <SelectContent>
                {DAYS.map((d) => <SelectItem key={d} value={d}>{t(`day${d}` as never)}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field label={t('broadcastTimeLabel')}>
            <Input type="time" {...form.register('broadcast_time')} />
          </Field>
        </div>
      </Section>

      <AdminPanel className="flex items-center justify-end gap-3 px-6 py-4">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push(isEdit ? `/admin/shows/${show.id}` : '/admin')}
        >
          {tCommon('cancel')}
        </Button>
        <Button type="submit" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? t('savingLabel') : isEdit ? t('saveShow') : t('createShowCta')}
        </Button>
      </AdminPanel>
    </form>
  )
}
