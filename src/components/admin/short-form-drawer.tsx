'use client'

import { useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslations } from 'next-intl'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { createShort, updateShort } from '@/app/[locale]/admin/actions'
import { extractYouTubeId } from '@/lib/youtube'
import type { Database } from '@/lib/database.types'
import { stripStorageCacheBust } from '@/lib/supabase-media'

type Short = Database['public']['Tables']['shorts']['Row']

function buildFormSchema(t: (key: string) => string) {
  return z.object({
    youtube_url: z.string().min(1, t('youtubeRequired')),
    youtube_video_id: z.string().min(1),
    title: z.string().min(1, t('titleRequired')),
    channel_name: z.string().optional().nullable(),
    thumbnail_url: z.string().optional().nullable(),
    duration_seconds: z.number().optional().nullable(),
    genre: z.string().optional().nullable(),
    expires_at: z.string().optional().nullable(),
  })
}

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

interface ShortFormDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  editingShort: Short | null
}

export function ShortFormDrawer({
  open,
  onOpenChange,
  editingShort,
}: ShortFormDrawerProps) {
  const t = useTranslations('admin.shortForm')
  const tShowForm = useTranslations('admin.showForm')
  const tCommon = useTranslations('common')
  const formSchema = useMemo(() => buildFormSchema(t), [t])
  type FormData = z.infer<typeof formSchema>

  const isEditing = !!editingShort
  const [fetching, setFetching] = useState(false)
  const [saving, setSaving] = useState(false)

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<FormData>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(formSchema) as any,
    defaultValues: {
      youtube_url: '',
      youtube_video_id: '',
      title: '',
      channel_name: '',
      thumbnail_url: '',
      duration_seconds: null,
      genre: '',
      expires_at: '',
    },
  })

  const thumbnailUrl = watch('thumbnail_url')
  const thumbnailPreviewUrl =
    stripStorageCacheBust(thumbnailUrl) ?? thumbnailUrl
  const videoId = watch('youtube_video_id')
  const youtubeUrl = watch('youtube_url')

  // Auto-extract video ID from URL without needing the API
  useEffect(() => {
    if (!youtubeUrl) return
    const id = extractYouTubeId(youtubeUrl)
    if (id) setValue('youtube_video_id', id)
  }, [youtubeUrl, setValue])

  // Populate form when editing
  useEffect(() => {
    if (open && editingShort) {
      reset({
        youtube_url: `https://youtube.com/shorts/${editingShort.youtube_video_id}`,
        youtube_video_id: editingShort.youtube_video_id,
        title: editingShort.title,
        channel_name: editingShort.channel_name ?? '',
        thumbnail_url: editingShort.thumbnail_url ?? '',
        duration_seconds: editingShort.duration_seconds,
        genre: editingShort.genre ?? '',
        expires_at: editingShort.expires_at
          ? new Date(editingShort.expires_at).toISOString().slice(0, 16)
          : '',
      })
    } else if (open) {
      reset({
        youtube_url: '',
        youtube_video_id: '',
        title: '',
        channel_name: '',
        thumbnail_url: '',
        duration_seconds: null,
        genre: '',
        expires_at: '',
      })
    }
  }, [open, editingShort, reset])

  // Fetch YouTube metadata when URL is pasted
  const fetchMeta = async () => {
    const url = watch('youtube_url')
    if (!url) return

    setFetching(true)
    try {
      const res = await fetch(
        `/api/youtube-meta?url=${encodeURIComponent(url)}`
      )
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        toast.error(body.error || t('toastMetaFailed'))
        setFetching(false)
        return
      }
      const meta = await res.json()
      setValue('youtube_video_id', meta.videoId)
      setValue('title', meta.title)
      setValue('channel_name', meta.channelTitle)
      setValue('thumbnail_url', meta.thumbnail)
      setValue('duration_seconds', meta.durationSeconds)
      toast.success(t('toastMetaLoaded'))
    } catch {
      toast.error(t('toastMetaFailed'))
    }
    setFetching(false)
  }

  const onSubmit = async (data: FormData) => {
    setSaving(true)
    // Strip the youtube_url field — it's not in the DB schema
    const { youtube_url: _, ...payload } = data
    // Convert empty expires_at to null, otherwise to ISO string
    const expiresAt = payload.expires_at
      ? new Date(payload.expires_at).toISOString()
      : null

    const actionData = {
      ...payload,
      sort_order: isEditing ? (editingShort?.sort_order ?? 0) : 0,
      expires_at: expiresAt,
    }
    const result = isEditing
      ? await updateShort(editingShort!.id, actionData)
      : await createShort(actionData)

    setSaving(false)

    if (result.success) {
      toast.success(isEditing ? t('toastUpdated') : t('toastSaved'))
      onOpenChange(false)
    } else {
      toast.error(result.error || t('toastSaveFailed'))
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex w-full flex-col p-0 sm:max-w-xl"
      >
        <SheetHeader className="border-border shrink-0 border-b px-6 pt-6 pb-4">
          <SheetTitle>{isEditing ? t('editTitle') : t('addTitle')}</SheetTitle>
        </SheetHeader>

        <form
          onSubmit={handleSubmit(onSubmit)}
          className="flex-1 space-y-5 overflow-y-auto px-6 py-5"
        >
          {/* YouTube URL + Fetch */}
          <div className="space-y-2">
            <Label htmlFor="youtube_url">{t('youtubeUrlLabel')}</Label>
            <div className="flex gap-2">
              <Input
                id="youtube_url"
                placeholder={t('youtubeUrlPlaceholder')}
                {...register('youtube_url')}
                className="flex-1"
              />
              <Button
                type="button"
                variant="outline"
                onClick={fetchMeta}
                disabled={fetching}
                className="shrink-0"
              >
                {fetching ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  t('fetch')
                )}
              </Button>
            </div>
            {errors.youtube_url && (
              <p className="text-sm text-red-400">
                {errors.youtube_url.message}
              </p>
            )}
          </div>

          {/* Preview thumbnail */}
          {thumbnailPreviewUrl && (
            <div className="flex items-start gap-4 rounded-lg border border-white/8 bg-white/[0.02] p-3">
              <img
                src={thumbnailPreviewUrl}
                alt={t('thumbnailAlt')}
                className="h-20 w-auto rounded object-cover"
              />
              <div className="text-muted-foreground space-y-1 text-xs">
                <div>
                  {t('videoIdLabel')}{' '}
                  <code className="text-foreground">{videoId}</code>
                </div>
                {watch('duration_seconds') && (
                  <div>
                    {t('durationLabel')} {watch('duration_seconds')}s
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Video ID — shown so admin can verify extraction worked */}
          {videoId && (
            <div className="space-y-1">
              <Label className="text-muted-foreground text-xs">
                {t('videoIdReadonlyLabel')}
              </Label>
              <Input
                value={videoId}
                readOnly
                className="font-mono text-xs opacity-60"
                {...register('youtube_video_id')}
              />
            </div>
          )}
          {!videoId && youtubeUrl && (
            <p className="text-sm text-red-400">{t('extractError')}</p>
          )}

          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="title">{t('titleLabel')}</Label>
            <Input id="title" {...register('title')} />
            {errors.title && (
              <p className="text-sm text-red-400">{errors.title.message}</p>
            )}
          </div>

          {/* Channel */}
          <div className="space-y-2">
            <Label htmlFor="channel_name">{t('channelLabel')}</Label>
            <Input id="channel_name" {...register('channel_name')} />
          </div>

          {/* Genre */}
          <div className="space-y-2">
            <div className="space-y-2">
              <Label htmlFor="genre">{t('genreLabel')}</Label>
              <select
                id="genre"
                {...register('genre')}
                className="border-input bg-background ring-offset-background focus-visible:ring-ring flex h-10 w-full rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:outline-none"
              >
                <option value="">{t('genreNone')}</option>
                {GENRES.map((g) => (
                  <option key={g} value={g}>
                    {tShowForm(`genre${g}` as never)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Expiration */}
          <div className="space-y-2">
            <Label htmlFor="expires_at">{t('expiresLabel')}</Label>
            <Input
              id="expires_at"
              type="datetime-local"
              {...register('expires_at')}
            />
            <p className="text-muted-foreground text-xs">{t('expiresHint')}</p>
          </div>
        </form>

        {/* Sticky footer */}
        <div className="border-border flex shrink-0 gap-3 border-t px-6 py-4">
          <Button
            onClick={handleSubmit(onSubmit)}
            disabled={saving}
            className="flex-1"
          >
            {saving ? (
              <Loader2 className="size-4 animate-spin" />
            ) : isEditing ? (
              t('save')
            ) : (
              t('add')
            )}
          </Button>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {tCommon('cancel')}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
