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
} from '@/components/ui/sheet'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { YouTubeUrlInput } from '@/components/admin/youtube-url-input'
import type { Database } from '@/lib/database.types'

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

const STATUS_OPTIONS = [
  { value: 'draft', label: 'Draft', desc: 'Not visible to viewers' },
  { value: 'coming-soon', label: 'Coming Soon', desc: 'Visible but not playable' },
  { value: 'published', label: 'Published', desc: 'Live and playable' },
] as const

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
        {required && <span className="text-destructive ml-0.5">*</span>}
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

  async function onSubmit(data: EpisodeFormData) {
    const normalized = {
      ...data,
      title_ar: data.title_ar || null, description_ar: data.description_ar || null,
      youtube_video_id: data.youtube_video_id || null, duration: data.duration || null,
    }
    const result = await onSave(normalized)
    if (result.success) {
      toast.success(isEdit ? `"${data.title}" saved` : `"${data.title}" created`)
      onOpenChange(false)
    } else {
      toast.error(result.error || 'Failed to save episode')
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
          <SheetTitle className="text-lg">{isEdit ? 'Edit Episode' : 'Create Episode'}</SheetTitle>
          <p className="text-sm text-muted-foreground">
            {isEdit ? `Editing "${episode.title}"` : `Episode #${nextEpisodeNumber}`}
          </p>
        </SheetHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col flex-1 min-h-0">
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-8">

            {/* EPISODE INFO */}
            <Section title="Episode Info">
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <Field label="Title" required error={errors.title?.message}>
                    <Input {...form.register('title')} placeholder="Episode title" />
                  </Field>
                </div>
                <Field label="Episode #" required error={errors.episode_number?.message}>
                  <Input type="number" min={1} {...form.register('episode_number', { valueAsNumber: true })} />
                </Field>
              </div>

              <Field label="Title (Arabic)">
                <Input dir="rtl" {...form.register('title_ar')} />
              </Field>

              {/* Status — radio buttons */}
              <div className="space-y-1.5">
                <Label className="text-sm">Status<span className="text-destructive ml-0.5">*</span></Label>
                <div className="grid grid-cols-3 gap-2">
                  {STATUS_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => form.setValue('status', opt.value, { shouldValidate: true })}
                      className={`rounded-lg border p-3 text-left transition-all ${
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
                <Field label="Duration" error={errors.duration?.message}>
                  <div className="relative">
                    <Input type="number" min={1} placeholder="25" {...form.register('duration', { valueAsNumber: true })} className="pr-10" />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">min</span>
                  </div>
                </Field>
              </div>
            </Section>

            {/* CONTENT */}
            <Section title="Content">
              <Field label="YouTube URL">
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
              </Field>

              <Field label="Description" required error={errors.description?.message}>
                <Textarea rows={5} {...form.register('description')} placeholder="What happens in this episode?" />
              </Field>

              <Field label="Description (Arabic)">
                <Textarea rows={5} dir="rtl" {...form.register('description_ar')} />
              </Field>
            </Section>
          </div>

          {/* Sticky footer */}
          <div className="shrink-0 border-t border-border bg-[var(--card)] px-6 py-4 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="rounded-full border border-white/20 bg-transparent px-5 py-2 text-sm font-medium text-white/70 transition-colors hover:bg-white/5"
            >
              Discard Changes
            </button>
            <button
              type="submit"
              disabled={form.formState.isSubmitting}
              className="rounded-full bg-white px-6 py-2 text-sm font-semibold text-black transition-colors hover:bg-white/90 disabled:opacity-50"
            >
              {form.formState.isSubmitting ? 'Saving...' : isEdit ? 'Save Episode' : 'Create Episode'}
            </button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  )
}
