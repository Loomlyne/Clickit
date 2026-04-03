'use client'

import { useEffect } from 'react'
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
import { Label } from '@/components/ui/label'
import type { Database } from '@/lib/database.types'

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const seasonFormSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  title_ar: z.string().optional().nullable(),
  season_number: z.number().int().positive('Season number must be positive'),
})

type SeasonFormData = z.infer<typeof seasonFormSchema>

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface SeasonFormDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  season?: Database['public']['Tables']['seasons']['Row'] | null
  showId: string
  nextSeasonNumber: number
  onSave: (data: SeasonFormData) => Promise<{ success: boolean; error?: string }>
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SeasonFormDrawer({
  open,
  onOpenChange,
  season,
  showId,
  nextSeasonNumber,
  onSave,
}: SeasonFormDrawerProps) {
  const isEdit = !!season

  const form = useForm<SeasonFormData>({
    resolver: zodResolver(seasonFormSchema),
    defaultValues: {
      title: '',
      title_ar: '',
      season_number: nextSeasonNumber,
    },
  })

  // Reset form when season data changes or drawer opens
  useEffect(() => {
    if (open) {
      if (season) {
        form.reset({
          title: season.title,
          title_ar: season.title_ar ?? '',
          season_number: season.season_number,
        })
      } else {
        form.reset({
          title: '',
          title_ar: '',
          season_number: nextSeasonNumber,
        })
      }
    }
  }, [open, season, nextSeasonNumber, form])

  async function onSubmit(data: SeasonFormData) {
    const normalized = {
      ...data,
      title_ar: data.title_ar || null,
    }

    const result = await onSave(normalized)

    if (result.success) {
      toast.success(isEdit ? 'Season saved' : 'Season created')
      onOpenChange(false)
    } else {
      toast.error(result.error || 'Failed to save season')
    }
  }

  // Suppress unused variable warning — showId is passed for context but used by parent
  void showId

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="sm:max-w-lg overflow-y-auto">
        <form onSubmit={form.handleSubmit(onSubmit)} className="flex h-full flex-col">
          <SheetHeader>
            <SheetTitle>{isEdit ? 'Edit Season' : 'Create Season'}</SheetTitle>
          </SheetHeader>

          <div className="flex-1 space-y-6 px-4 pb-4">
            {/* Title */}
            <div className="space-y-2">
              <Label htmlFor="season-title">Title *</Label>
              <Input
                id="season-title"
                placeholder="e.g., Season 1"
                {...form.register('title')}
                aria-invalid={!!form.formState.errors.title}
              />
              {form.formState.errors.title && (
                <p className="text-sm text-destructive">{form.formState.errors.title.message}</p>
              )}
            </div>

            {/* Title Arabic */}
            <div className="space-y-2">
              <Label htmlFor="season-title-ar">Title (Arabic)</Label>
              <Input
                id="season-title-ar"
                dir="rtl"
                {...form.register('title_ar')}
              />
            </div>

            {/* Season Number */}
            <div className="space-y-2">
              <Label htmlFor="season-number">Season Number *</Label>
              <Input
                id="season-number"
                type="number"
                min={1}
                {...form.register('season_number', { valueAsNumber: true })}
                aria-invalid={!!form.formState.errors.season_number}
              />
              {form.formState.errors.season_number && (
                <p className="text-sm text-destructive">{form.formState.errors.season_number.message}</p>
              )}
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
              {form.formState.isSubmitting ? 'Saving...' : 'Save Season'}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  )
}
