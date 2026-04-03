'use client'

import { useEffect } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
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
import { YouTubeUrlInput } from '@/components/admin/youtube-url-input'
import type { Database } from '@/lib/database.types'

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const episodeFormSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  title_ar: z.string().optional().nullable(),
  description: z.string().min(1, 'Description is required'),
  description_ar: z.string().optional().nullable(),
  episode_number: z.number().int().positive('Episode number must be positive'),
  youtube_video_id: z.string().optional().nullable(),
  duration: z.number().int().positive('Duration must be positive').optional().nullable(),
  status: z.enum(['draft', 'coming-soon', 'published']),
})

type EpisodeFormData = z.infer<typeof episodeFormSchema>

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface EpisodeFormDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  episode?: Database['public']['Tables']['episodes']['Row'] | null
  showId: string
  seasonId: string
  nextEpisodeNumber: number
  onSave: (data: EpisodeFormData) => Promise<{ success: boolean; error?: string }>
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function EpisodeFormDrawer({
  open,
  onOpenChange,
  episode,
  showId,
  seasonId,
  nextEpisodeNumber,
  onSave,
}: EpisodeFormDrawerProps) {
  const isEdit = !!episode

  const form = useForm<EpisodeFormData>({
    resolver: zodResolver(episodeFormSchema),
    defaultValues: {
      title: '',
      title_ar: '',
      description: '',
      description_ar: '',
      episode_number: nextEpisodeNumber,
      youtube_video_id: '',
      duration: null,
      status: 'draft',
    },
  })

  // Reset form when episode data changes or drawer opens
  useEffect(() => {
    if (open) {
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
        })
      } else {
        form.reset({
          title: '',
          title_ar: '',
          description: '',
          description_ar: '',
          episode_number: nextEpisodeNumber,
          youtube_video_id: '',
          duration: null,
          status: 'draft',
        })
      }
    }
  }, [open, episode, nextEpisodeNumber, form])

  async function onSubmit(data: EpisodeFormData) {
    const normalized = {
      ...data,
      title_ar: data.title_ar || null,
      description_ar: data.description_ar || null,
      youtube_video_id: data.youtube_video_id || null,
      duration: data.duration || null,
    }

    const result = await onSave(normalized)

    if (result.success) {
      toast.success(isEdit ? 'Episode saved' : 'Episode created')
      onOpenChange(false)
    } else {
      toast.error(result.error || 'Failed to save episode')
    }
  }

  // Suppress unused variable warnings — passed for context, used by parent
  void showId
  void seasonId

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="sm:max-w-lg overflow-y-auto">
        <form onSubmit={form.handleSubmit(onSubmit)} className="flex h-full flex-col">
          <SheetHeader>
            <SheetTitle>{isEdit ? 'Edit Episode' : 'Create Episode'}</SheetTitle>
          </SheetHeader>

          <div className="flex-1 space-y-6 px-4 pb-4">
            {/* Title */}
            <div className="space-y-2">
              <Label htmlFor="ep-title">Title *</Label>
              <Input
                id="ep-title"
                {...form.register('title')}
                aria-invalid={!!form.formState.errors.title}
              />
              {form.formState.errors.title && (
                <p className="text-sm text-destructive">{form.formState.errors.title.message}</p>
              )}
            </div>

            {/* Title Arabic */}
            <div className="space-y-2">
              <Label htmlFor="ep-title-ar">Title (Arabic)</Label>
              <Input
                id="ep-title-ar"
                dir="rtl"
                {...form.register('title_ar')}
              />
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="ep-description">Description *</Label>
              <Textarea
                id="ep-description"
                rows={3}
                {...form.register('description')}
                aria-invalid={!!form.formState.errors.description}
              />
              {form.formState.errors.description && (
                <p className="text-sm text-destructive">{form.formState.errors.description.message}</p>
              )}
            </div>

            {/* Description Arabic */}
            <div className="space-y-2">
              <Label htmlFor="ep-description-ar">Description (Arabic)</Label>
              <Textarea
                id="ep-description-ar"
                rows={3}
                dir="rtl"
                {...form.register('description_ar')}
              />
            </div>

            {/* Episode Number */}
            <div className="space-y-2">
              <Label htmlFor="ep-number">Episode Number *</Label>
              <Input
                id="ep-number"
                type="number"
                min={1}
                {...form.register('episode_number', { valueAsNumber: true })}
                aria-invalid={!!form.formState.errors.episode_number}
              />
              {form.formState.errors.episode_number && (
                <p className="text-sm text-destructive">{form.formState.errors.episode_number.message}</p>
              )}
            </div>

            {/* YouTube URL */}
            <div className="space-y-2">
              <Label>YouTube URL</Label>
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
            </div>

            {/* Duration */}
            <div className="space-y-2">
              <Label htmlFor="ep-duration">Duration (minutes)</Label>
              <Input
                id="ep-duration"
                type="number"
                min={1}
                placeholder="e.g., 25"
                {...form.register('duration', { valueAsNumber: true })}
              />
              {form.formState.errors.duration && (
                <p className="text-sm text-destructive">{form.formState.errors.duration.message}</p>
              )}
            </div>

            {/* Status */}
            <div className="space-y-2">
              <Label>Status *</Label>
              <Select
                value={form.watch('status')}
                onValueChange={(val) =>
                  form.setValue('status', val as EpisodeFormData['status'], { shouldValidate: true })
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="coming-soon">Coming Soon</SelectItem>
                  <SelectItem value="published">Published</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <SheetFooter className="sticky bottom-0 border-t border-border bg-background">
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
            >
              Discard Changes
            </Button>
            <Button
              type="submit"
              disabled={form.formState.isSubmitting}
            >
              {form.formState.isSubmitting ? 'Saving...' : 'Save Episode'}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  )
}
