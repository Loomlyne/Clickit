'use client'

import { useEffect, useMemo } from 'react'
import { useForm } from 'react-hook-form'
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
import { ArtworkUploadZone } from '@/components/admin/artwork-upload-zone'
import { generateSlug } from '@/lib/slug'
import type { Database } from '@/lib/database.types'

// ---------------------------------------------------------------------------
// Schema (client-side, mirrors server schema for form validation)
// ---------------------------------------------------------------------------

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
})

type ShowFormData = z.infer<typeof showFormSchema>

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

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

const DAYS = [
  'Monday', 'Tuesday', 'Wednesday', 'Thursday',
  'Friday', 'Saturday', 'Sunday',
]

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ShowFormDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  show?: Database['public']['Tables']['shows']['Row'] | null
  onSave: (data: ShowFormData & { id?: string }) => Promise<{ success: boolean; error?: string }>
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ShowFormDrawer({
  open,
  onOpenChange,
  show,
  onSave,
}: ShowFormDrawerProps) {
  const isEdit = !!show

  // Pre-generate UUID for create mode so artwork uploads know the path
  const generatedId = useMemo(() => {
    if (!isEdit) return crypto.randomUUID()
    return show.id
  }, [isEdit, show?.id])

  const form = useForm<ShowFormData>({
    resolver: zodResolver(showFormSchema),
    defaultValues: {
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
    },
  })

  // Reset form when show data changes or drawer opens
  useEffect(() => {
    if (open) {
      if (show) {
        form.reset({
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
        })
      } else {
        form.reset({
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
        })
      }
    }
  }, [open, show, form])

  // Auto-generate slug from title in create mode
  const watchedTitle = form.watch('title')
  useEffect(() => {
    if (!isEdit && watchedTitle) {
      form.setValue('slug', generateSlug(watchedTitle))
    }
  }, [watchedTitle, isEdit, form])

  async function onSubmit(data: ShowFormData) {
    // Normalize empty strings to null for optional fields
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
    }

    // For create mode, include the pre-generated ID
    if (!isEdit) {
      normalized.id = generatedId
    }

    const result = await onSave(normalized)

    if (result.success) {
      toast.success(isEdit ? 'Show saved' : 'Show created')
      onOpenChange(false)
    } else {
      toast.error('Failed to save. Check your connection and try again.')
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="sm:max-w-lg overflow-y-auto"
      >
        <form onSubmit={form.handleSubmit(onSubmit)} className="flex h-full flex-col">
          <SheetHeader>
            <SheetTitle>{isEdit ? 'Edit Show' : 'Create Show'}</SheetTitle>
          </SheetHeader>

          <div className="flex-1 space-y-6 px-4 pb-4">
            {/* Title */}
            <div className="space-y-2">
              <Label htmlFor="title">Title *</Label>
              <Input
                id="title"
                {...form.register('title')}
                aria-invalid={!!form.formState.errors.title}
              />
              {form.formState.errors.title && (
                <p className="text-sm text-destructive">{form.formState.errors.title.message}</p>
              )}
            </div>

            {/* Title Arabic */}
            <div className="space-y-2">
              <Label htmlFor="title_ar">Title (Arabic)</Label>
              <Input
                id="title_ar"
                dir="rtl"
                {...form.register('title_ar')}
              />
            </div>

            {/* Slug */}
            <div className="space-y-2">
              <Label htmlFor="slug">Slug *</Label>
              <Input
                id="slug"
                {...form.register('slug')}
                aria-invalid={!!form.formState.errors.slug}
              />
              {form.formState.errors.slug && (
                <p className="text-sm text-destructive">{form.formState.errors.slug.message}</p>
              )}
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="description">Description *</Label>
              <Textarea
                id="description"
                rows={4}
                {...form.register('description')}
                aria-invalid={!!form.formState.errors.description}
              />
              {form.formState.errors.description && (
                <p className="text-sm text-destructive">{form.formState.errors.description.message}</p>
              )}
            </div>

            {/* Description Arabic */}
            <div className="space-y-2">
              <Label htmlFor="description_ar">Description (Arabic)</Label>
              <Textarea
                id="description_ar"
                rows={4}
                dir="rtl"
                {...form.register('description_ar')}
              />
            </div>

            {/* Tagline */}
            <div className="space-y-2">
              <Label htmlFor="tagline">Tagline</Label>
              <Input
                id="tagline"
                {...form.register('tagline')}
              />
            </div>

            {/* Tagline Arabic */}
            <div className="space-y-2">
              <Label htmlFor="tagline_ar">Tagline (Arabic)</Label>
              <Input
                id="tagline_ar"
                dir="rtl"
                {...form.register('tagline_ar')}
              />
            </div>

            {/* Genre */}
            <div className="space-y-2">
              <Label>Genre *</Label>
              <Select
                value={form.watch('genre')}
                onValueChange={(val) => form.setValue('genre', val, { shouldValidate: true })}
              >
                <SelectTrigger className="w-full" aria-invalid={!!form.formState.errors.genre}>
                  <SelectValue placeholder="Select genre" />
                </SelectTrigger>
                <SelectContent>
                  {GENRES.map((g) => (
                    <SelectItem key={g} value={g}>{g}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {form.formState.errors.genre && (
                <p className="text-sm text-destructive">{form.formState.errors.genre.message}</p>
              )}
            </div>

            {/* Brand Color */}
            <div className="space-y-2">
              <Label>Brand Color *</Label>
              <Select
                value={form.watch('brand_color')}
                onValueChange={(val) =>
                  form.setValue('brand_color', val as ShowFormData['brand_color'], { shouldValidate: true })
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select brand color" />
                </SelectTrigger>
                <SelectContent>
                  {BRAND_COLORS.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      <span className="flex items-center gap-2">
                        <span
                          className="inline-block size-3 rounded-full"
                          style={{ backgroundColor: c.hex }}
                        />
                        {c.label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Status */}
            <div className="space-y-2">
              <Label>Status *</Label>
              <Select
                value={form.watch('status')}
                onValueChange={(val) =>
                  form.setValue('status', val as ShowFormData['status'], { shouldValidate: true })
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="coming-soon">Coming Soon</SelectItem>
                  <SelectItem value="now-streaming">Now Streaming</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Broadcast Day */}
            <div className="space-y-2">
              <Label>Broadcast Day</Label>
              <Select
                value={form.watch('broadcast_day') ?? ''}
                onValueChange={(val) => form.setValue('broadcast_day', val || null)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select day" />
                </SelectTrigger>
                <SelectContent>
                  {DAYS.map((d) => (
                    <SelectItem key={d} value={d}>{d}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Broadcast Time */}
            <div className="space-y-2">
              <Label htmlFor="broadcast_time">Broadcast Time</Label>
              <Input
                id="broadcast_time"
                placeholder="HH:MM"
                {...form.register('broadcast_time')}
              />
            </div>

            {/* Artwork Upload Zones */}
            <ArtworkUploadZone
              showId={generatedId}
              slot="poster"
              currentUrl={show?.poster_url ?? null}
              onUploadComplete={(url) => form.setValue('poster_url', url)}
              label="Poster Image"
              aspectHint="2:3 portrait"
            />

            <ArtworkUploadZone
              showId={generatedId}
              slot="hero"
              currentUrl={show?.hero_url ?? null}
              onUploadComplete={(url) => form.setValue('hero_url', url)}
              label="Hero Banner"
              aspectHint="16:9 landscape"
            />

            <ArtworkUploadZone
              showId={generatedId}
              slot="logo"
              currentUrl={show?.logo_url ?? null}
              onUploadComplete={(url) => form.setValue('logo_url', url)}
              label="Show Logo"
              aspectHint="Free-form (PNG with transparency)"
            />
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
              {form.formState.isSubmitting ? 'Saving...' : 'Save Show'}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  )
}
