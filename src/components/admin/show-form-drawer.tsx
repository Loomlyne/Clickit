'use client'

import { useEffect, useMemo } from 'react'
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
  title: z.string().min(1, 'Title is required'),
  title_ar: z.string().optional().nullable(),
  slug: z.string().min(1, 'Slug is required'),
  description: z.string().min(1, 'Description is required'),
  description_ar: z.string().optional().nullable(),
  tagline: z.string().optional().nullable(),
  tagline_ar: z.string().optional().nullable(),
  genre: z.string().min(1, 'Genre is required'),
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
})

type ShowFormData = z.infer<typeof showFormSchema>

const GENRES = [
  'Travel', 'Health', 'Music', 'Comedy', 'Cooking',
  'Kids', 'Poetry', 'Cinema', 'Tech', 'Entertainment', 'Culture',
]

const BRAND_COLORS: { value: string; label: string; hex: string }[] = [
  { value: 'brand-blue', label: 'Blue', hex: '#2C3569' },
  { value: 'brand-purple', label: 'Purple', hex: '#9F54A0' },
  { value: 'brand-green', label: 'Green', hex: '#50A258' },
  { value: 'brand-red', label: 'Red', hex: '#DB3F34' },
  { value: 'brand-orange', label: 'Orange', hex: '#EA8C2E' },
]

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

// Section wrapper with label
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

// Field wrapper
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

interface ShowFormDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  show?: Database['public']['Tables']['shows']['Row'] | null
  onSave: (data: ShowFormData & { id?: string }) => Promise<{ success: boolean; error?: string }>
}

export function ShowFormDrawer({ open, onOpenChange, show, onSave }: ShowFormDrawerProps) {
  const isEdit = !!show

  const generatedId = useMemo(() => {
    if (!isEdit) return crypto.randomUUID()
    return show.id
  }, [isEdit, show?.id])

  const form = useForm<ShowFormData>({
    resolver: zodResolver(showFormSchema),
    defaultValues: {
      title: '', title_ar: '', slug: '', description: '', description_ar: '',
      tagline: '', tagline_ar: '', genre: '', brand_color: 'brand-blue',
      status: 'draft', broadcast_day: '', broadcast_time: '',
      poster_url: '', hero_url: '', logo_url: '',
      hero_image_mobile_url: '', hero_video_url: '', hero_video_type: null,
      hero_video_mobile_url: '', hero_video_mobile_type: null,
    },
  })

  useEffect(() => {
    if (open) {
      if (show) {
        form.reset({
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
        })
      } else {
        form.reset({
          title: '', title_ar: '', slug: '', description: '', description_ar: '',
          tagline: '', tagline_ar: '', genre: '', brand_color: 'brand-blue',
          status: 'draft', broadcast_day: '', broadcast_time: '',
          poster_url: '', hero_url: '', logo_url: '',
          hero_image_mobile_url: '', hero_video_url: '', hero_video_type: null,
          hero_video_mobile_url: '', hero_video_mobile_type: null,
        })
      }
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
    }
    if (!isEdit) normalized.id = generatedId

    const result = await onSave(normalized)
    if (result.success) {
      toast.success(isEdit ? `"${data.title}" saved` : `"${data.title}" created`)
      onOpenChange(false)
    } else {
      toast.error(result.error || 'Failed to save. Check your connection and try again.')
    }
  }

  const errors = form.formState.errors

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="sm:max-w-xl w-full p-0 flex flex-col">
        <SheetHeader className="px-6 pt-6 pb-4 border-b border-border shrink-0">
          <SheetTitle className="text-lg">{isEdit ? 'Edit Show' : 'Create Show'}</SheetTitle>
          <p className="text-sm text-muted-foreground">
            {isEdit ? `Editing "${show.title}"` : 'Fill in the details to create a new show'}
          </p>
        </SheetHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col flex-1 min-h-0">
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-8">

            {/* BASIC INFO */}
            <Section title="Basic Info">
              <Field label="Title" required error={errors.title?.message}>
                <Input {...form.register('title')} placeholder="e.g., Last Call" />
              </Field>

              <Field label="Title (Arabic)">
                <Input dir="rtl" {...form.register('title_ar')} />
              </Field>

              <Field label="Slug" required error={errors.slug?.message}>
                <div className="relative">
                  <Input
                    {...form.register('slug')}
                    disabled={isEdit}
                    className={isEdit ? 'pr-8 opacity-70' : ''}
                  />
                  {isEdit && <Lock className="absolute right-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />}
                </div>
                {!isEdit && <p className="text-xs text-muted-foreground">Auto-generated from title</p>}
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Genre" required error={errors.genre?.message}>
                  <Select
                    value={form.watch('genre')}
                    onValueChange={(val) => form.setValue('genre', val, { shouldValidate: true })}
                  >
                    <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>
                      {GENRES.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </Field>

                <Field label="Status" required>
                  <Select
                    value={form.watch('status')}
                    onValueChange={(val) => form.setValue('status', val as ShowFormData['status'], { shouldValidate: true })}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="draft">Draft</SelectItem>
                      <SelectItem value="coming-soon">Coming Soon</SelectItem>
                      <SelectItem value="now-streaming">Now Streaming</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
              </div>
            </Section>

            {/* DESCRIPTION */}
            <Section title="Description">
              <Field label="Description" required error={errors.description?.message}>
                <Textarea rows={4} {...form.register('description')} placeholder="What is this show about?" />
              </Field>

              <Field label="Description (Arabic)">
                <Textarea rows={4} dir="rtl" {...form.register('description_ar')} />
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Tagline">
                  <Input {...form.register('tagline')} placeholder="Short hook" />
                </Field>
                <Field label="Tagline (Arabic)">
                  <Input dir="rtl" {...form.register('tagline_ar')} />
                </Field>
              </div>
            </Section>

            {/* BRANDING */}
            <Section title="Branding">
              <Field label="Brand Color">
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
                      <span className="text-[10px] text-muted-foreground">{c.label}</span>
                    </button>
                  ))}
                </div>
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <ArtworkUploadZone
                  showId={generatedId} slot="poster"
                  currentUrl={form.watch('poster_url') || null}
                  onUploadComplete={(url) => form.setValue('poster_url', url)}
                  onDelete={() => form.setValue('poster_url', '')}
                  label="Poster" aspectHint="2:3 · card artwork"
                />
                <ArtworkUploadZone
                  showId={generatedId} slot="logo"
                  currentUrl={form.watch('logo_url') || null}
                  onUploadComplete={(url) => form.setValue('logo_url', url)}
                  onDelete={() => form.setValue('logo_url', '')}
                  label="Logo" aspectHint="PNG · transparent"
                />
              </div>
            </Section>

            {/* HERO MEDIA */}
            <Section title="Hero Media">
              <p className="text-xs text-muted-foreground -mt-2">
                Media for the browse hero. Pick one source per screen size — image, MP4, or YouTube link.
                Switching source clears the previous one.
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

            {/* SCHEDULE */}
            <Section title="Schedule">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Broadcast Day">
                  <Select
                    value={form.watch('broadcast_day') ?? ''}
                    onValueChange={(val) => form.setValue('broadcast_day', val || null)}
                  >
                    <SelectTrigger><SelectValue placeholder="Select day" /></SelectTrigger>
                    <SelectContent>
                      {DAYS.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </Field>

                <Field label="Broadcast Time">
                  <Input type="time" {...form.register('broadcast_time')} />
                </Field>
              </div>
            </Section>
          </div>

          {/* Sticky footer */}
          <div className="shrink-0 border-t border-border bg-[var(--card)] px-6 py-4 flex items-center justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Discard Changes
            </Button>
            <Button
              type="submit"
              disabled={form.formState.isSubmitting}
            >
              {form.formState.isSubmitting ? 'Saving...' : isEdit ? 'Save Show' : 'Create Show'}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  )
}
