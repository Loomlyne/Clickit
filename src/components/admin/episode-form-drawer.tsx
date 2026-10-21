'use client'

import { useEffect, useRef, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { useArabicMissingToast } from '@/components/admin/arabic-missing-toast'
import { Loader2, Sparkles } from 'lucide-react'
import { getVideoDuration } from '@/lib/youtube'
import {
  fetchYouTubeMeta,
  type YouTubeMeta,
} from '@/app/[locale]/admin/actions'
import {
  YOUTUBE_ERROR_MESSAGE_KEYS,
  type YouTubeErrorCode,
} from '@/lib/youtube-errors'
import { formatQuotaReset, nextQuotaReset } from '@/lib/youtube-quota'
import { isolate } from '@/lib/i18n-format'
import {
  DESCRIPTION_MAX,
  TITLE_MAX,
  dominantScript,
  needsEnglishTitle,
} from '@/server/youtube/script'

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
import { YouTubeStatusChip } from '@/components/admin/youtube-status-chip'
import type { Database } from '@/lib/database.types'
import { dubaiLocalToUtcIso, utcIsoToDubaiLocal } from '@/lib/scheduling'

const episodeFormSchema = z.object({
  title: z.string().min(1, 'titleRequired'),
  title_ar: z.string().optional().nullable(),
  description: z.string().min(1, 'descriptionRequired'),
  description_ar: z.string().optional().nullable(),
  episode_number: z.number().int().positive('episodeNumberRequired'),
  youtube_video_id: z.string().optional().nullable(),
  duration: z.number().int().positive('fieldRequired').optional().nullable(),
  status: z.enum(['draft', 'coming-soon', 'published']),
  // Dubai wall-clock datetime-local string in the form; converted to a UTC ISO
  // string on submit. Only sent when status is coming-soon.
  publish_at: z.string().optional().nullable(),
})

type EpisodeFormData = z.infer<typeof episodeFormSchema>

type ShowDefaults = {
  title: string
  title_ar: string | null
  description: string
  description_ar: string | null
}

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

interface EpisodeFormDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  episode?: Database['public']['Tables']['episodes']['Row'] | null
  showId: string
  seasonId: string
  showDefaults: ShowDefaults
  nextEpisodeNumber: number
  /** A refused link comes back as data.youtubeError (06-13). */
  onSave: (
    data: EpisodeFormData
  ) => Promise<{ success: boolean; error?: string; data?: unknown }>
  /** Opens with the cursor in this field (06-18 "Needs English title" mark). */
  initialFocus?: 'title'
}

type DynamicTranslator = {
  (key: string, values?: Record<string, string | number>): string
  markup(
    key: string,
    values: Record<string, string | number | ((chunks: string) => string)>
  ): string
}

type DuplicateParams = { show: string; season: number; episode: number }

/** Cap by code points so a surrogate pair is never split. */
function cap(text: string, max: number): string {
  return Array.from(text.trim()).slice(0, max).join('')
}

/** The refusal a save came back with, when the server refused the video. */
function readYouTubeError(
  data: unknown
): { code: YouTubeErrorCode; params?: DuplicateParams } | null {
  if (typeof data !== 'object' || data === null) return null
  const refusal = (data as { youtubeError?: unknown }).youtubeError
  if (typeof refusal !== 'object' || refusal === null) return null
  const code = (refusal as { code?: unknown }).code
  if (typeof code !== 'string' || !(code in YOUTUBE_ERROR_MESSAGE_KEYS)) {
    return null
  }
  const params = (refusal as { params?: DuplicateParams }).params
  return { code: code as YouTubeErrorCode, params }
}

export function EpisodeFormDrawer({
  open,
  onOpenChange,
  episode,
  showId,
  seasonId,
  showDefaults,
  nextEpisodeNumber,
  onSave,
  initialFocus,
}: EpisodeFormDrawerProps) {
  const isEdit = !!episode
  const locale = useLocale()
  const t = useTranslations('admin.episodeForm')
  const tYtErrors = useTranslations('admin.youtubeErrors')
  const tYtStatus = useTranslations('admin.youtubeStatus')
  const tCommon = useTranslations('common')
  const warnArabicMissing = useArabicMissingToast()
  const tErrors = useTranslations('errors')

  const STATUS_OPTIONS = [
    {
      value: 'draft' as const,
      label: t('statusDraft'),
      desc: t('statusDraftDesc'),
    },
    {
      value: 'coming-soon' as const,
      label: t('statusScheduled'),
      desc: t('statusScheduledDesc'),
    },
    {
      value: 'published' as const,
      label: t('statusPublished'),
      desc: t('statusPublishedDesc'),
    },
  ]

  const inheritedEpisodeFields = {
    title: showDefaults.title,
    title_ar: showDefaults.title_ar ?? '',
    description: showDefaults.description,
    description_ar: showDefaults.description_ar ?? '',
  }

  const form = useForm<EpisodeFormData>({
    resolver: zodResolver(episodeFormSchema),
    defaultValues: {
      ...inheritedEpisodeFields,
      episode_number: nextEpisodeNumber,
      youtube_video_id: '',
      duration: null,
      status: 'draft',
      publish_at: '',
    },
  })

  // The plain-words refusal under the link field (null: nothing to show).
  const [linkError, setLinkError] = useState<string | null>(null)
  const urlFieldRef = useRef<HTMLDivElement>(null)

  // Words come from i18n keys and the code only; nothing from the server is shown raw.
  function refusalText(code: YouTubeErrorCode, params?: DuplicateParams) {
    // The key comes from a table, so the typed translator is widened here.
    const tYt = tYtErrors as unknown as DynamicTranslator
    const key = YOUTUBE_ERROR_MESSAGE_KEYS[code]
    if (code === 'video_duplicate' && params) {
      return tYt.markup(key, {
        show: params.show,
        season: params.season,
        episode: params.episode,
        bdi: (chunks) => isolate(chunks),
      })
    }
    return tYt(key, {
      time: formatQuotaReset(nextQuotaReset(new Date()), locale),
    })
  }

  function showLinkRefusal(code: YouTubeErrorCode, params?: DuplicateParams) {
    setLinkError(refusalText(code, params))
  }

  function focusLinkField() {
    const field = urlFieldRef.current
    field?.scrollIntoView({ block: 'center', behavior: 'smooth' })
    field?.querySelector('input')?.focus()
  }

  useEffect(() => {
    if (open) {
      setLinkError(null)
      if (episode) {
        form.reset({
          title: episode.title,
          title_ar: episode.title_ar ?? '',
          description: episode.description,
          description_ar: episode.description_ar ?? '',
          episode_number: episode.episode_number,
          youtube_video_id: episode.youtube_video_id ?? '',
          duration: episode.duration ?? null,
          status: episode.status as EpisodeFormData['status'],
          publish_at: utcIsoToDubaiLocal(episode.publish_at),
        })
      } else {
        form.reset({
          title: showDefaults.title,
          title_ar: showDefaults.title_ar ?? '',
          description: showDefaults.description,
          description_ar: showDefaults.description_ar ?? '',
          episode_number: nextEpisodeNumber,
          youtube_video_id: '',
          duration: null,
          status: 'draft',
          publish_at: '',
        })
      }
    }
  }, [
    open,
    episode,
    nextEpisodeNumber,
    form,
    showDefaults.title,
    showDefaults.title_ar,
    showDefaults.description,
    showDefaults.description_ar,
  ])

  // Auto-detect duration from YouTube video
  const lastDetectedId = useRef<string | null>(null)
  const watchedVideoId = form.watch('youtube_video_id')
  useEffect(() => {
    const videoId = watchedVideoId?.trim()
    if (!videoId || videoId.length !== 11 || videoId === lastDetectedId.current)
      return
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
    const sourceData = data
    const normalized = {
      ...sourceData,
      title_ar: sourceData.title_ar || null,
      description_ar: sourceData.description_ar || null,
      youtube_video_id: sourceData.youtube_video_id || null,
      duration: sourceData.duration || null,
      // Scheduling only applies to coming-soon episodes; clear it otherwise.
      // Convert the Dubai wall-clock input to a UTC ISO string for storage.
      publish_at:
        sourceData.status === 'coming-soon'
          ? dubaiLocalToUtcIso(sourceData.publish_at)
          : null,
    }
    const result = await onSave(normalized)
    if (result.success) {
      if (!warnArabicMissing(result)) toast.success(isEdit ? t('episodeUpdated') : t('episodeCreated'))
      onOpenChange(false)
      return
    }
    const refusal = readYouTubeError(result.data)
    if (refusal) {
      // The server re-checked the video on save and refused it: say why under
      // the link field, take the cursor there, and keep every other field.
      showLinkRefusal(refusal.code, refusal.params)
      focusLinkField()
      toast.error(t('notSavedToast'))
      return
    }
    toast.error(result.error || tCommon('error'))
  }

  void showId
  void seasonId

  const errors = form.formState.errors
  const currentStatus = form.watch('status')
  const watchedTitle = form.watch('title')
  const watchedTitleAr = form.watch('title_ar')
  const titleNeedsEnglish = needsEnglishTitle({
    title: watchedTitle ?? '',
    title_ar: watchedTitleAr || null,
  })

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex w-full flex-col p-0 sm:max-w-xl"
        onOpenAutoFocus={(event) => {
          if (initialFocus === 'title') {
            event.preventDefault()
            form.setFocus('title')
          }
        }}
      >
        <SheetHeader className="border-border shrink-0 border-b px-6 pt-6 pb-4">
          <SheetTitle className="text-lg">
            {isEdit ? t('editEpisode') : t('createEpisode')}
          </SheetTitle>
          <p className="text-muted-foreground text-sm">
            {isEdit
              ? t('editingEpisode', { title: episode.title })
              : t('createFromShowDescription', {
                  number: nextEpisodeNumber,
                  title: showDefaults.title,
                })}
          </p>
        </SheetHeader>

        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="flex min-h-0 flex-1 flex-col"
        >
          <div className="flex-1 space-y-8 overflow-y-auto px-6 py-5">
            <Section title={t('sectionInfo')}>
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
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
                      placeholder={t('episodeTitlePlaceholder')}
                    />
                  </Field>
                  {titleNeedsEnglish && (
                    <div className="mt-2 flex items-center gap-2">
                      <YouTubeStatusChip tone="warn">
                        {tYtStatus('needsEnglishTitle')}
                      </YouTubeStatusChip>
                      <span className="text-[11px] text-[var(--text-mute)]">
                        {t('needsEnglishTitleHint')}
                      </span>
                    </div>
                  )}
                </div>
                <Field
                  label={t('episodeNumberLabel')}
                  required
                  error={
                    errors.episode_number?.message
                      ? tErrors(errors.episode_number.message as never)
                      : undefined
                  }
                >
                  <Input
                    type="number"
                    min={1}
                    {...form.register('episode_number', {
                      valueAsNumber: true,
                    })}
                  />
                </Field>
              </div>

              <Field label={t('titleArLabel')}>
                <Input dir="rtl" {...form.register('title_ar')} />
              </Field>

              <div className="space-y-1.5">
                <Label className="text-sm">
                  {t('statusLabel')}
                  <span className="text-destructive ms-0.5">*</span>
                </Label>
                <div className="grid grid-cols-3 gap-2">
                  {STATUS_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() =>
                        form.setValue('status', opt.value, {
                          shouldValidate: true,
                        })
                      }
                      className={`rounded-lg border p-3 text-start transition-all ${
                        currentStatus === opt.value
                          ? 'border-[var(--line-2)] bg-[var(--bg-3)] ring-1 ring-white/20'
                          : 'border-border hover:border-[var(--line-2)] hover:bg-[var(--bg-2)]'
                      }`}
                    >
                      <span className="text-foreground text-sm font-medium">
                        {opt.label}
                      </span>
                      <span className="text-muted-foreground mt-0.5 block text-[11px]">
                        {opt.desc}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {currentStatus === 'coming-soon' && (
                <Field label={t('scheduleLabel')}>
                  <Input
                    type="datetime-local"
                    {...form.register('publish_at')}
                  />
                  <p className="text-muted-foreground text-xs">
                    {t('scheduleHelp')}
                  </p>
                </Field>
              )}

              <div className="grid grid-cols-2 gap-3">
                <Field
                  label={t('durationLabel')}
                  error={
                    errors.duration?.message
                      ? tErrors(errors.duration.message as never)
                      : undefined
                  }
                >
                  <div className="relative">
                    <Input
                      type="number"
                      min={1}
                      placeholder="25"
                      {...form.register('duration', { valueAsNumber: true })}
                      className="pe-10"
                    />
                    <span className="text-muted-foreground absolute end-3 top-1/2 -translate-y-1/2 text-xs">
                      {t('durationUnit')}
                    </span>
                  </div>
                </Field>
              </div>
            </Section>

            <Section title={t('sectionContent')}>
              <Field label={t('youtubeUrlLabel')}>
                <div ref={urlFieldRef}>
                  <Controller
                    name="youtube_video_id"
                    control={form.control}
                    render={({ field }) => (
                      <YouTubeUrlInput
                        value={field.value ?? ''}
                        onChange={(videoId) => {
                          setLinkError(null)
                          field.onChange(videoId ?? '')
                        }}
                        error={linkError ?? undefined}
                      />
                    )}
                  />
                </div>
                {watchedVideoId && watchedVideoId.length === 11 && (
                  <YouTubeFetchButton
                    videoId={watchedVideoId}
                    isEdit={isEdit}
                    excludeEpisodeId={episode?.id}
                    onRefused={showLinkRefusal}
                    onFetched={(meta) => {
                      setLinkError(null)
                      // Only fill fields that are currently empty, never overwrite
                      // what the admin has already typed. Arabic text goes to the
                      // Arabic fields, nothing is translated (D-04).
                      const title = cap(meta.title, TITLE_MAX)
                      if (title) {
                        if (dominantScript(title) === 'ar') {
                          if (!form.getValues('title_ar')) {
                            form.setValue('title_ar', title, {
                              shouldDirty: true,
                            })
                          }
                          if (!form.getValues('title')) {
                            form.setValue('title', title, {
                              shouldDirty: true,
                            })
                          }
                        } else if (!form.getValues('title')) {
                          form.setValue('title', title, { shouldDirty: true })
                        }
                      }
                      const description = cap(meta.description, DESCRIPTION_MAX)
                      if (description) {
                        const field =
                          dominantScript(description) === 'ar'
                            ? 'description_ar'
                            : 'description'
                        if (!form.getValues(field)) {
                          form.setValue(field, description, {
                            shouldDirty: true,
                          })
                        }
                      }
                      if (
                        !form.getValues('duration') &&
                        meta.durationMinutes &&
                        meta.durationMinutes > 0
                      ) {
                        form.setValue('duration', meta.durationMinutes, {
                          shouldDirty: true,
                        })
                      }
                    }}
                  />
                )}
              </Field>

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
                  rows={5}
                  {...form.register('description')}
                  placeholder={t('descriptionPlaceholder')}
                />
              </Field>

              <Field label={t('descriptionArLabel')}>
                <Textarea
                  rows={5}
                  dir="rtl"
                  {...form.register('description_ar')}
                />
              </Field>
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
 * Button below the YouTube URL field. Asks the server (fetchYouTubeMeta, admin
 * only, key stays on the server) to check the video and fetch its title,
 * description and length, and hands them back to the parent form. A refused
 * video is explained in plain words under the link field by the parent.
 */
function YouTubeFetchButton({
  videoId,
  isEdit,
  excludeEpisodeId,
  onFetched,
  onRefused,
}: {
  videoId: string
  isEdit: boolean
  /** The episode being edited: its own video is not a duplicate. */
  excludeEpisodeId?: string
  onFetched: (meta: YouTubeMeta) => void
  onRefused: (code: YouTubeErrorCode, params?: DuplicateParams) => void
}) {
  const [loading, setLoading] = useState(false)
  const t = useTranslations('admin.episodeForm')

  async function onClick() {
    setLoading(true)
    try {
      const url = `https://www.youtube.com/watch?v=${videoId}`
      const res = await fetchYouTubeMeta(url, { excludeEpisodeId })
      if (!res.success) {
        if (res.data?.code) {
          onRefused(res.data.code, res.data.params)
        } else {
          toast.error(t('toastFetchFailed'))
        }
        return
      }
      onFetched(res.data)
      toast.success(
        isEdit ? t('toastFetchSuccess') : t('toastFetchDurationSuccess')
      )
    } catch {
      toast.error(t('toastFetchFailed'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button
      type="button"
      variant="outline"
      className="mt-2 min-h-11 px-6 py-2 text-sm font-bold"
      onClick={onClick}
      disabled={loading}
    >
      {loading ? (
        <Loader2 className="size-4 animate-spin" />
      ) : (
        <Sparkles className="size-4" />
      )}
      {isEdit ? t('fetchYoutubeMetadata') : t('fetchYoutubeDuration')}
    </Button>
  )
}
