'use client'

import { useEffect, useMemo } from 'react'
import { useTranslations } from 'next-intl'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Lock } from 'lucide-react'

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
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
import { ArtworkUploadZone } from '@/components/admin/artwork-upload-zone'
import { HeroMediaPicker } from '@/components/admin/hero-media-picker'
import { generateSlug } from '@/lib/slug'
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
  brand_color: z.enum([
    'brand-blue',
    'brand-purple',
    'brand-green',
    'brand-red',
    'brand-orange',
  ]),
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
})

type ShowFormData = z.infer<typeof showFormSchema>

const GENRES = [
  'Travel',
  'Health',
  'Music',
  'Comedy',
  'Cooking',
  'Kids',
  'Poetry',
  'Cinema',
  'Tech',
  'Entertainment',
  'Culture',
]

const BRAND_COLORS: { value: string; key: string; hex: string }[] = [
  { value: 'brand-blue', key: 'colorBlue', hex: '#2C3569' },
  { value: 'brand-purple', key: 'colorPurple', hex: '#9F54A0' },
  { value: 'brand-green', key: 'colorGreen', hex: '#50A258' },
  { value: 'brand-red', key: 'colorRed', hex: '#DB3F34' },
  { value: 'brand-orange', key: 'colorOrange', hex: '#EA8C2E' },
]

const DAYS = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
]

// Section wrapper with label
function Section({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-4">
      <h3 className="text-muted-foreground border-border border-b pb-2 text-xs font-semibold tracking-wider uppercase">
        {title}
      </h3>
      {children}
    </div>
  )
}

// Field wrapper
function Field({
  label,
  required,
  error,
  children,
}: {
  label: string
  required?: boolean
  error?: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm">
        {label}
        {required && <span className="text-destructive ms-0.5">*</span>}
      </Label>
      {children}
      {error && <p className="text-destructive text-xs">{error}</p>}
    </div>
  )
}

type DbShow = Database['public']['Tables']['shows']['Row']

function getFormDefaults(show: DbShow | null): ShowFormData {
  if (!show) {
    return {
      title: '',
      title_ar: '',
      slug: '',
      description: '',
      description_ar: '',
      tagline: '',
      tagline_ar: '',
      genre: '',
      brand_color: 'brand-blue',
      status: 'draft',
      broadcast_day: '',
      broadcast_time: '',
      poster_url: '',
      hero_url: '',
      logo_url: '',
      hero_image_mobile_url: '',
      hero_video_url: '',
      hero_video_type: null,
      hero_video_mobile_url: '',
      hero_video_mobile_type: null,
    }
  }
  return {
    title: show.title,
    title_ar: show.title_ar ?? '',
    slug: show.slug,
    description: show.description,
    description_ar: show.description_ar ?? '',
    tagline: show.tagline ?? '',
    tagline_ar: show.tagline_ar ?? '',
    genre: show.genre,
    brand_color: show.brand_color as ShowFormData['brand_color'],
    status: show.status as ShowFormData['status'],
    broadcast_day: show.broadcast_day ?? '',
    broadcast_time: show.broadcast_time ?? '',
    poster_url: show.poster_url ?? '',
    hero_url: show.hero_url ?? '',
    logo_url: show.logo_url ?? '',
    hero_image_mobile_url: show.hero_image_mobile_url ?? '',
    hero_video_url: show.hero_video_url ?? '',
    hero_video_type: (show.hero_video_type as 'mp4' | 'youtube' | null) ?? null,
    hero_video_mobile_url: show.hero_video_mobile_url ?? '',
    hero_video_mobile_type:
      (show.hero_video_mobile_type as 'mp4' | 'youtube' | null) ?? null,
  }
}

interface ShowFormDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  show?: DbShow | null
  onSave: (
    data: ShowFormData & { id?: string }
  ) => Promise<{ success: boolean; error?: string }>
}

export function ShowFormDrawer({
  open,
  onOpenChange,
  show,
  onSave,
}: ShowFormDrawerProps) {
  const isEdit = !!show
  const t = useTranslations('admin.showForm')
  const tCommon = useTranslations('common')
  const tErrors = useTranslations('errors')

  const generatedId = useMemo(() => {
    if (!isEdit) return crypto.randomUUID()
    return show.id
  }, [isEdit, show?.id])

  const form = useForm<ShowFormData>({
    resolver: zodResolver(showFormSchema),
    defaultValues: getFormDefaults(null),
  })

  useEffect(() => {
    if (open) {
      form.reset(getFormDefaults(show ?? null))
    }
  }, [open, show, form])

  const watchedTitle = form.watch('title')
  useEffect(() => {
    if (!isEdit && watchedTitle) {
      form.setValue('slug', generateSlug(watchedTitle))
    }
  }, [watchedTitle, isEdit, form])

  async function onSubmit(data: ShowFormData) {
    const normalized: ShowFormData & { id?: string } = {
      ...data,
      title_ar: data.title_ar || null,
      description_ar: data.description_ar || null,
      tagline: data.tagline || null,
      tagline_ar: data.tagline_ar || null,
      broadcast_day: data.broadcast_day || null,
      broadcast_time: data.broadcast_time || null,
      poster_url: data.poster_url || null,
      hero_url: data.hero_url || null,
      logo_url: data.logo_url || null,
      hero_image_mobile_url: data.hero_image_mobile_url || null,
      hero_video_url: data.hero_video_url || null,
      hero_video_type: data.hero_video_type || null,
      hero_video_mobile_url: data.hero_video_mobile_url || null,
      hero_video_mobile_type: data.hero_video_mobile_type || null,
    }
    if (!isEdit) normalized.id = generatedId

    const result = await onSave(normalized)
    if (result.success) {
      toast.success(isEdit ? t('showUpdated') : t('showCreated'))
      onOpenChange(false)
    } else {
      toast.error(result.error || tCommon('error'))
    }
  }

  const errors = form.formState.errors

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex w-full flex-col p-0 sm:max-w-xl"
      >
        <SheetHeader className="border-border shrink-0 border-b px-6 pt-6 pb-4">
          <SheetTitle className="text-lg">
            {isEdit ? t('editShow') : t('createShowCta')}
          </SheetTitle>
          <p className="text-muted-foreground text-sm">
            {isEdit
              ? t('editingShow', { title: show.title })
              : t('newShowDescription')}
          </p>
        </SheetHeader>

        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="flex min-h-0 flex-1 flex-col"
        >
          <div className="flex-1 space-y-8 overflow-y-auto px-6 py-5">
            {/* BASIC INFO */}
            <Section title={t('basicInfoTab')}>
              <Field
                label={t('titleLabel')}
                required
                error={
                  errors.title?.message
                    ? tErrors(errors.title.message as never)
                    : undefined
                }
              >
                <Input
                  {...form.register('title')}
                  placeholder={t('titlePlaceholder')}
                />
              </Field>

              <Field label={t('titleArLabel')}>
                <Input dir="rtl" {...form.register('title_ar')} />
              </Field>

              <Field
                label={t('slugLabel')}
                required
                error={
                  errors.slug?.message
                    ? tErrors(errors.slug.message as never)
                    : undefined
                }
              >
                <div className="relative">
                  <Input
                    {...form.register('slug')}
                    disabled={isEdit}
                    className={isEdit ? 'pe-8 opacity-70' : ''}
                  />
                  {isEdit && (
                    <Lock className="text-muted-foreground absolute top-1/2 right-2.5 size-3.5 -translate-y-1/2" />
                  )}
                </div>
                {!isEdit && (
                  <p className="text-muted-foreground text-xs">
                    {t('autoSlugHint')}
                  </p>
                )}
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field
                  label={t('genreLabel')}
                  required
                  error={
                    errors.genre?.message
                      ? tErrors(errors.genre.message as never)
                      : undefined
                  }
                >
                  <Select
                    value={form.watch('genre')}
                    onValueChange={(val) =>
                      form.setValue('genre', val, { shouldValidate: true })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={t('selectPlaceholder')} />
                    </SelectTrigger>
                    <SelectContent>
                      {GENRES.map((g) => (
                        <SelectItem key={g} value={g}>
                          {t(`genre${g}` as never)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>

                <Field label={t('statusLabel')} required>
                  <Select
                    value={form.watch('status')}
                    onValueChange={(val) =>
                      form.setValue('status', val as ShowFormData['status'], {
                        shouldValidate: true,
                      })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="draft">{t('statusDraft')}</SelectItem>
                      <SelectItem value="coming-soon">
                        {t('statusComingSoon')}
                      </SelectItem>
                      <SelectItem value="now-streaming">
                        {t('statusNowStreaming')}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
              </div>
            </Section>

            {/* DESCRIPTION */}
            <Section title={t('descriptionSection')}>
              <Field
                label={t('descriptionLabel')}
                required
                error={
                  errors.description?.message
                    ? tErrors(errors.description.message as never)
                    : undefined
                }
              >
                <Textarea
                  rows={4}
                  {...form.register('description')}
                  placeholder={t('descriptionPlaceholder')}
                />
              </Field>

              <Field label={t('descriptionArLabel')}>
                <Textarea
                  rows={4}
                  dir="rtl"
                  {...form.register('description_ar')}
                />
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label={t('taglineLabel')}>
                  <Input
                    {...form.register('tagline')}
                    placeholder={t('taglinePlaceholder')}
                  />
                </Field>
                <Field label={t('taglineArLabel')}>
                  <Input dir="rtl" {...form.register('tagline_ar')} />
                </Field>
              </div>
            </Section>

            {/* BRANDING */}
            <Section title={t('brandingSection')}>
              <Field label={t('brandColorLabel')}>
                <div className="flex gap-2">
                  {BRAND_COLORS.map((c) => (
                    <button
                      key={c.value}
                      type="button"
                      onClick={() =>
                        form.setValue(
                          'brand_color',
                          c.value as ShowFormData['brand_color']
                        )
                      }
                      className={`flex flex-col items-center gap-1 rounded-lg p-2 transition-all ${
                        form.watch('brand_color') === c.value
                          ? 'bg-white/10 ring-2 ring-white'
                          : 'hover:bg-white/5'
                      }`}
                    >
                      <span
                        className="size-8 rounded-full"
                        style={{ backgroundColor: c.hex }}
                      />
                      <span className="text-muted-foreground text-[10px]">
                        {t(c.key as never)}
                      </span>
                    </button>
                  ))}
                </div>
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <ArtworkUploadZone
                  showId={generatedId}
                  slot="poster"
                  currentUrl={form.watch('poster_url') || null}
                  onUploadComplete={(url) => form.setValue('poster_url', url)}
                  onDelete={() => form.setValue('poster_url', '')}
                  label={t('posterLabel')}
                  aspectHint={t('posterAspectHint')}
                />
                <ArtworkUploadZone
                  showId={generatedId}
                  slot="logo"
                  currentUrl={form.watch('logo_url') || null}
                  onUploadComplete={(url) => form.setValue('logo_url', url)}
                  onDelete={() => form.setValue('logo_url', '')}
                  label={t('logoLabel')}
                  aspectHint={t('logoAspectHint')}
                />
              </div>
            </Section>

            {/* HERO MEDIA */}
            <Section title={t('heroMediaSection')}>
              <p className="text-muted-foreground -mt-2 text-xs">
                {t('heroMediaSwitchHint')}
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
                onImageChange={(url) =>
                  form.setValue('hero_image_mobile_url', url ?? '')
                }
                onVideoChange={(video) => {
                  form.setValue('hero_video_mobile_url', video?.url ?? '')
                  form.setValue('hero_video_mobile_type', video?.type ?? null)
                }}
              />
            </Section>

            {/* SCHEDULE */}
            <Section title={t('scheduleSection')}>
              <div className="grid grid-cols-2 gap-3">
                <Field label={t('broadcastDayLabel')}>
                  <Select
                    value={form.watch('broadcast_day') ?? ''}
                    onValueChange={(val) =>
                      form.setValue('broadcast_day', val || null)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={t('selectDayPlaceholder')} />
                    </SelectTrigger>
                    <SelectContent>
                      {DAYS.map((d) => (
                        <SelectItem key={d} value={d}>
                          {t(`day${d}` as never)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>

                <Field label={t('broadcastTimeLabel')}>
                  <Input type="time" {...form.register('broadcast_time')} />
                </Field>
              </div>
            </Section>
          </div>

          {/* Sticky footer */}
          <div className="border-border flex shrink-0 items-center justify-end gap-3 border-t bg-[var(--card)] px-6 py-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              {t('discardChanges')}
            </Button>
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting
                ? t('savingLabel')
                : isEdit
                  ? t('saveShow')
                  : t('createShowCta')}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  )
}
