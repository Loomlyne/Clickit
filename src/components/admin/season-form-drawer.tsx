'use client'

import { useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { useForm } from 'react-hook-form'
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
import { Label } from '@/components/ui/label'
import type { Database } from '@/lib/database.types'

const seasonFormSchema = z.object({
  title: z.string().min(1, 'titleRequired'),
  title_ar: z.string().optional().nullable(),
  season_number: z.number().int().positive('fieldRequired'),
})

type SeasonFormData = z.infer<typeof seasonFormSchema>

interface SeasonFormDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  season?: Database['public']['Tables']['seasons']['Row'] | null
  showId: string
  nextSeasonNumber: number
  onSave: (data: SeasonFormData) => Promise<{ success: boolean; error?: string }>
}

export function SeasonFormDrawer({
  open, onOpenChange, season, showId, nextSeasonNumber, onSave,
}: SeasonFormDrawerProps) {
  const isEdit = !!season
  const t = useTranslations('admin.seasonForm')
  const tCommon = useTranslations('common')
  const tErrors = useTranslations('errors')

  const form = useForm<SeasonFormData>({
    resolver: zodResolver(seasonFormSchema),
    defaultValues: { title: '', title_ar: '', season_number: nextSeasonNumber },
  })

  useEffect(() => {
    if (open) {
      if (season) {
        form.reset({ title: season.title, title_ar: season.title_ar ?? '', season_number: season.season_number })
      } else {
        form.reset({ title: '', title_ar: '', season_number: nextSeasonNumber })
      }
    }
  }, [open, season, nextSeasonNumber, form])

  async function onSubmit(data: SeasonFormData) {
    const normalized = { ...data, title_ar: data.title_ar || null }
    const result = await onSave(normalized)
    if (result.success) {
      toast.success(isEdit ? t('seasonUpdated') : t('seasonCreated'))
      form.reset({ title: '', title_ar: '', season_number: nextSeasonNumber })
      onOpenChange(false)
    } else {
      toast.error(result.error || tCommon('error'))
    }
  }

  void showId
  const errors = form.formState.errors

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="sm:max-w-md w-full p-0 flex flex-col">
        <SheetHeader className="px-6 pt-6 pb-4 border-b border-border shrink-0">
          <SheetTitle className="text-lg">{isEdit ? t('editSeason') : t('createSeason')}</SheetTitle>
          <p className="text-sm text-muted-foreground">
            {isEdit
              ? t('editingSeason', { title: season.title })
              : t('seasonNumberDescription', { number: nextSeasonNumber })}
          </p>
        </SheetHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col flex-1 min-h-0">
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
            <div className="space-y-1.5">
              <Label className="text-sm">{t('titleLabel')}<span className="text-destructive ms-0.5">*</span></Label>
              <Input {...form.register('title')} placeholder={t('titlePlaceholder')} />
              {errors.title && <p className="text-xs text-destructive">{tErrors(errors.title.message as never)}</p>}
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm">{t('titleArLabel')}</Label>
              <Input dir="rtl" {...form.register('title_ar')} />
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm">{t('seasonNumberLabel')}<span className="text-destructive ms-0.5">*</span></Label>
              <Input type="number" min={1} {...form.register('season_number', { valueAsNumber: true })} />
              {errors.season_number && <p className="text-xs text-destructive">{tErrors(errors.season_number.message as never)}</p>}
            </div>
          </div>

          <div className="shrink-0 border-t border-border bg-[var(--card)] px-6 py-4 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="rounded-full border border-white/20 bg-transparent px-5 py-2 text-sm font-medium text-white/70 transition-colors hover:bg-white/5"
            >
              {t('discardChanges')}
            </button>
            <button
              type="submit"
              disabled={form.formState.isSubmitting}
              className="rounded-full bg-white px-6 py-2 text-sm font-semibold text-black transition-colors hover:bg-white/90 disabled:opacity-50"
            >
              {form.formState.isSubmitting
                ? t('savingLabel')
                : isEdit
                  ? t('saveSeason')
                  : t('createSeason')}
            </button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  )
}
