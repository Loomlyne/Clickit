'use client'

import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
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
import type { Database } from '@/lib/database.types'

type Short = Database['public']['Tables']['shorts']['Row']

const formSchema = z.object({
  youtube_url: z.string().min(1, 'YouTube URL is required'),
  youtube_video_id: z.string().min(1),
  title: z.string().min(1, 'Title is required'),
  channel_name: z.string().optional().nullable(),
  thumbnail_url: z.string().optional().nullable(),
  duration_seconds: z.number().optional().nullable(),
  genre: z.string().optional().nullable(),
  sort_order: z.number().optional(),
  expires_at: z.string().optional().nullable(),
})

type FormData = z.infer<typeof formSchema>

const GENRES = [
  'Travel', 'Health', 'Music', 'Comedy', 'Cooking',
  'Kids', 'Poetry', 'Cinema', 'Tech', 'Entertainment', 'Culture',
]

interface ShortFormDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  editingShort: Short | null
}

export function ShortFormDrawer({ open, onOpenChange, editingShort }: ShortFormDrawerProps) {
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
      sort_order: 0,
      expires_at: '',
    },
  })

  const thumbnailUrl = watch('thumbnail_url')
  const videoId = watch('youtube_video_id')

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
        sort_order: editingShort.sort_order,
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
        sort_order: 0,
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
      const res = await fetch(`/api/youtube-meta?url=${encodeURIComponent(url)}`)
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        toast.error(body.error || 'Failed to fetch video data')
        setFetching(false)
        return
      }
      const meta = await res.json()
      setValue('youtube_video_id', meta.videoId)
      setValue('title', meta.title)
      setValue('channel_name', meta.channelTitle)
      setValue('thumbnail_url', meta.thumbnail)
      setValue('duration_seconds', meta.durationSeconds)
      toast.success('Metadata loaded')
    } catch {
      toast.error('Failed to fetch video data')
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
      sort_order: payload.sort_order ?? 0,
      expires_at: expiresAt,
    }
    const result = isEditing
      ? await updateShort(editingShort!.id, actionData)
      : await createShort(actionData)

    setSaving(false)

    if (result.success) {
      toast.success(isEditing ? 'Short updated' : 'Short added')
      onOpenChange(false)
    } else {
      toast.error(result.error || 'Failed to save')
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>{isEditing ? 'Edit Short' : 'Add Short'}</SheetTitle>
        </SheetHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-5">
          {/* YouTube URL + Fetch */}
          <div className="space-y-2">
            <Label htmlFor="youtube_url">YouTube Shorts URL</Label>
            <div className="flex gap-2">
              <Input
                id="youtube_url"
                placeholder="https://youtube.com/shorts/..."
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
                {fetching ? <Loader2 className="size-4 animate-spin" /> : 'Fetch'}
              </Button>
            </div>
            {errors.youtube_url && (
              <p className="text-sm text-red-400">{errors.youtube_url.message}</p>
            )}
          </div>

          {/* Preview thumbnail */}
          {thumbnailUrl && (
            <div className="flex gap-4">
              <img
                src={thumbnailUrl}
                alt="Thumbnail"
                className="h-24 w-auto rounded object-cover"
              />
              {videoId && (
                <div className="text-xs text-muted-foreground">
                  Video ID: <code className="text-foreground">{videoId}</code>
                </div>
              )}
            </div>
          )}

          {/* Hidden video ID */}
          <input type="hidden" {...register('youtube_video_id')} />

          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input id="title" {...register('title')} />
            {errors.title && (
              <p className="text-sm text-red-400">{errors.title.message}</p>
            )}
          </div>

          {/* Channel */}
          <div className="space-y-2">
            <Label htmlFor="channel_name">Channel</Label>
            <Input id="channel_name" {...register('channel_name')} />
          </div>

          {/* Genre */}
          <div className="space-y-2">
            <Label htmlFor="genre">Genre</Label>
            <select
              id="genre"
              {...register('genre')}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="">None</option>
              {GENRES.map((g) => (
                <option key={g} value={g}>{g}</option>
              ))}
            </select>
          </div>

          {/* Sort order */}
          <div className="space-y-2">
            <Label htmlFor="sort_order">Sort Order</Label>
            <Input
              id="sort_order"
              type="number"
              {...register('sort_order', { valueAsNumber: true })}
            />
            <p className="text-xs text-muted-foreground">Lower numbers appear first</p>
          </div>

          {/* Expiration */}
          <div className="space-y-2">
            <Label htmlFor="expires_at">Expires At</Label>
            <Input
              id="expires_at"
              type="datetime-local"
              {...register('expires_at')}
            />
            <p className="text-xs text-muted-foreground">
              Leave empty for no expiration. Short disappears from the platform after this date.
            </p>
          </div>

          {/* Submit */}
          <div className="flex gap-3 pt-4">
            <Button type="submit" disabled={saving} className="flex-1">
              {saving ? (
                <Loader2 className="size-4 animate-spin" />
              ) : isEditing ? (
                'Save Changes'
              ) : (
                'Add Short'
              )}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  )
}
