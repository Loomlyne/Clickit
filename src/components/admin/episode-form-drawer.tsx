'use client'

import { useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Loader2, Sparkles } from 'lucide-react'
import { getVideoDuration } from '@/lib/youtube'

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { YouTubeUrlInput } from '@/components/admin/youtube-url-input'
import type { Database } from '@/lib/database.types'

const episodeFormSchema = z.object({
  title: z.string().min(1, 'titleRequired'),
  title_ar: z.string().optional().nullable(),
  description: z.string().min(1, 'descriptionRequired'),
  description_ar: z.string().optional().nullable(),
  episode_number: z.number().int().positive('episodeNumberRequired'),
  youtube_video_id: z.string().optional().nullable(),
  duration: z.number().int().positive('fieldRequired').optional().nullable(),
  status: z.enum(['draft', 'coming-soon', 'published']),
})

type EpisodeFormData = z.infer<typeof episodeFormSchema>

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-4">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground border-b border-border pb-2">
        {title}
      </h3>
      {children}
    </div>
  )
}

function Field({ label, required, error, children }: { label: string; required?: boolean; error?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm">
        {label}
        {required && <span className="text-destructive ms-0.5">*</span>}
      </Label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}

interface EpisodeFormDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  episode?: Database['public']['Tables']['episodes']['Row'] | null
  showId: string
  seasonId: string
  nextEpisodeNumber: number
  onSave: (data: EpisodeFormData) => Promise<{ success: boolean; error?: string }>
}

export function EpisodeFormDrawer({
  open, onOpenChange, episode, showId, seasonId, nextEpisodeNumber, onSave,
}: EpisodeFormDrawerProps) {
  const isEdit = !!episode
  const t = useTranslations('admin.episodeForm')
  const tCommon = useTranslations('common')
  const tErrors = useTranslations('errors')

  const STATUS_OPTIONS = [
    { value: 'draft' as const, label: t('statusDraft'), desc: t('statusDraftDesc') },
    { value: 'coming-soon' as const, label: t('statusScheduled'), desc: t('statusScheduledDesc') },
    { value: 'published' as const, label: t('statusPublished'), desc: t('statusPublishedDesc') },
  ]

  const form = useForm<EpisodeFormData>({
    resolver: zodResolver(episodeFormSchema),
    defaultValues: {
      title: '', title_ar: '', description: '', description_ar: '',
      episode_number: nextEpisodeNumber, youtube_video_id: '',
      duration: null, status: 'draft',
    },
  })

  useEffect(() => {
    if (open) {
      if (episode) {
        form.reset({
          title: episode.title, title_ar: episode.title_ar ?? '',
          description: episode.description, description_ar: episode.description_ar ?? '',
          episode_number: episode.episode_number,
          youtube_video_id: episode.youtube_video_id ?? '',
          duration: episode.duration ?? null,
          status: episode.status as EpisodeFormData['status'],
        })
      } else {
        form.reset({
          title: '', title_ar: '', description: '', description_ar: '',
          episode_number: nextEpisodeNumber, youtube_video_id: '',
          duration: null, status: 'draft',
        })
      }
    }
  }, [open, episode, nextEpisodeNumber, form])

  // Auto-detect duration from YouTube video
  const lastDetectedId = useRef<string | null>(null)
  const watchedVideoId = form.watch('youtube_video_id')
  useEffect(() => {
    const videoId = watchedVideoId?.trim()
    if (!videoId || videoId.length !== 11 || videoId === lastDetectedId.current) return
    // Only auto-fill if duration is empty
    const currentDuration = form.getValues('duration')
    if (currentDuration) return

    lastDetectedId.current = videoId
    getVideoDuration(videoId).then((seconds) => {
      if (seconds && seconds > 0) {
        const minutes = Math.round(seconds / 60)
        form.setValue('duration', minutes, { shouldDirty: true })
        toast.success(t('durationDetected', { minutes }))
      }
    })
  }, [watchedVideoId, form, t])

  async function onSubmit(data: EpisodeFormData) {
    const normalized = {
      ...data,
      title_ar: data.title_ar || null, description_ar: data.description_ar || null,
      youtube_video_id: data.youtube_video_id || null, duration: data.duration || null,
    }
    const result = await onSave(normalized)
    if (result.success) {
      toast.success(isEdit ? t('episodeUpdated') : t('episodeCreated'))
      onOpenChange(false)
    } else {
      toast.error(result.error || tCommon('error'))
    }
  }

  void showId
  void seasonId

  const errors = form.formState.errors
  const currentStatus = form.watch('status')

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="sm:max-w-xl w-full p-0 flex flex-col">
        <SheetHeader className="px-6 pt-6 pb-4 border-b border-border shrink-0">
          <SheetTitle className="text-lg">{isEdit ? t('editEpisode') : t('createEpisode')}</SheetTitle>
          <p className="text-sm text-muted-foreground">
            {isEdit
              ? t('editingEpisode', { title: episode.title })
              : t('episodeNumberDescription', { number: nextEpisodeNumber })}
          </p>
        </SheetHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col flex-1 min-h-0">
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-8">

            <Section title={t('sectionInfo')}>
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <Field label={t('titleLabel')} required error={errors.title?.message ? tErrors(errors.title.message as never) : undefined}>
                    <Input {...form.register('title')} placeholder={t('episodeTitlePlaceholder')} />
                  </Field>
                </div>
                <Field label={t('episodeNumberLabel')} required error={errors.episode_number?.message ? tErrors(errors.episode_number.message as never) : undefined}>
                  <Input type="number" min={1} {...form.register('episode_number', { valueAsNumber: true })} />
                </Field>
              </div>

              <Field label={t('titleArLabel')}>
                <Input dir="rtl" {...form.register('title_ar')} />
              </Field>

              {/* Status — radio buttons */}
              <div className="space-y-1.5">
                <Label className="text-sm">{t('statusLabel')}<span className="text-destructive ms-0.5">*</span></Label>
                <div className="grid grid-cols-3 gap-2">
                  {STATUS_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => form.setValue('status', opt.value, { shouldValidate: true })}
                      className={`rounded-lg border p-3 text-start transition-all ${
                        currentStatus === opt.value
                          ? 'border-white/30 bg-white/10 ring-1 ring-white/20'
                          : 'border-border hover:border-white/15 hover:bg-white/[0.03]'
                      }`}
                    >
                      <span className="text-sm font-medium text-foreground">{opt.label}</span>
                      <span className="block text-[10px] text-muted-foreground mt-0.5">{opt.desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Field label={t('durationLabel')} error={errors.duration?.message ? tErrors(errors.duration.message as never) : undefined}>
                  <div className="relative">
                    <Input type="number" min={1} placeholder="25" {...form.register('duration', { valueAsNumber: true })} className="pe-10" />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">{t('durationUnit')}</span>
                  </div>
                </Field>
              </div>
            </Section>

            <Section title={t('sectionContent')}>
              <Field label={t('youtubeUrlLabel')}>
                <Controller
                  name="youtube_video_id"
                  control={form.control}
                  render={({ field }) => (
                    <YouTubeUrlInput
                      value={field.value ?? ''}
                      onChange={(videoId) => field.onChange(videoId ?? '')}
                    />
                  )}
                />
                {watchedVideoId && watchedVideoId.length === 11 && (
                  <YouTubeFetchButton
                    videoId={watchedVideoId}
                    onFetched={(meta) => {
                      // Only fill fields that are currently empty — never overwrite
                      // what the admin has already typed.
                      if (!form.getValues('title') && meta.title) {
                        form.setValue('title', meta.title, { shouldDirty: true })
                      }
                      if (!form.getValues('description') && meta.description) {
                        // YouTube descriptions are long; cap at 1000 chars to keep
                        // our DB row sane and the UI clean.
                        form.setValue(
                          'description',
                          meta.description.slice(0, 1000),
                          { shouldDirty: true }
                        )
                      }
                      if (!form.getValues('duration') && meta.durationSeconds > 0) {
                        form.setValue('duration', Math.round(meta.durationSeconds / 60), {
                          shouldDirty: true,
                        })
                      }
                    }}
                  />
                )}
              </Field>

              <Field label={t('descriptionLabel')} required error={errors.description?.message ? tErrors(errors.description.message as never) : undefined}>
                <Textarea rows={5} {...form.register('description')} placeholder={t('descriptionPlaceholder')} />
              </Field>

              <Field label={t('descriptionArLabel')}>
                <Textarea rows={5} dir="rtl" {...form.register('description_ar')} />
              </Field>
            </Section>
          </div>

          {/* Sticky footer */}
          <div className="shrink-0 border-t border-border bg-[var(--card)] px-6 py-4 flex items-center justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              {t('discardChanges')}
            </Button>
            <Button
              type="submit"
              disabled={form.formState.isSubmitting}
            >
              {form.formState.isSubmitting
                ? t('savingLabel')
                : isEdit
                  ? t('saveEpisode')
                  : t('createEpisode')}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  )
}

/**
 * Small button below the YouTube URL field. When clicked, calls
 * /api/youtube-meta to fetch title / description / duration from the
 * YouTube Data API and passes them back to the parent form.
 *
 * Admin-only endpoint on the server side. If no API key is configured
 * (503 response) the button shows an actionable toast pointing to settings.
 */
type YouTubeMeta = {
  title: string
  description: string
  durationSeconds: number
  thumbnail: string | null
}

function YouTubeFetchButton({
  videoId,
  onFetched,
}: {
  videoId: string
  onFetched: (meta: YouTubeMeta) => void
}) {
  const [loading, setLoading] = useState(false)
  const t = useTranslations('admin.episodeForm')

  async function onClick() {
    setLoading(true)
    try {
      const url = `https://www.youtube.com/watch?v=${videoId}`
      const res = await fetch(`/api/youtube-meta?url=${encodeURIComponent(url)}`)
      if (res.status === 503) {
        toast.error(t('toastNoYoutubeKey'), {
          description: t('toastNoYoutubeKeyDescription'),
        })
        return
      }
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        toast.error(body.error ?? t('toastFetchFailed'))
        return
      }
      const meta: YouTubeMeta = await res.json()
      onFetched(meta)
      toast.success(t('toastFetchSuccess'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/[0.04] px-3 py-1.5 text-xs font-medium text-white/80 transition-colors hover:border-white/25 hover:text-white disabled:opacity-50"
    >
      {loading ? (
        <Loader2 className="size-3 animate-spin" />
      ) : (
        <Sparkles className="size-3" />
      )}
      {t('fetchYoutubeMetadata')}
    </button>
  )
}
