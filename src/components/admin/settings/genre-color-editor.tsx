'use client'

import { useState } from 'react'
import { useLocale } from 'next-intl'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { updateGenreConfig } from '@/app/[locale]/admin/actions'
import type { GenreConfig } from '@/lib/config'
import { SettingsCard } from './settings-card'

/**
 * Genre color overrides — maps genre name to a brand-palette color.
 * The hardcoded GENRE_COLORS map in src/components/home/genres-grid.tsx
 * still serves as the fallback when a genre has no override.
 *
 * Kept intentionally minimal: preset picker + optional "hidden" toggle.
 * Custom hex entry is out of scope — CIT branding guideline limits the
 * palette to six colors.
 */

const PRESETS: Array<{ label: string; value: string }> = [
  { label: 'Blue', value: '#2C3569' },
  { label: 'Purple', value: '#9F54A0' },
  { label: 'Green', value: '#50A258' },
  { label: 'Red', value: '#DB3F34' },
  { label: 'Orange', value: '#EA8C2E' },
  { label: 'Yellow', value: '#F8C623' },
]

// Every genre surfaced in the landing page today.
// If the admin adds a new genre to a show, it'll appear in the UI automatically
// via getDistinctGenres() but the color editor will need a re-add here (or we
// can fetch genres server-side — tracked as future work).
const KNOWN_GENRES = [
  'Entertainment',
  'Documentary',
  'Health',
  'Tech',
  'Kids',
  'Music',
  'Comedy',
  'Cooking',
  'Travel',
  'Poetry',
  'Cinema',
  'Drama',
  'Talk',
  'Business',
  'Quiz',
  'Podcast',
]

export function GenreColorEditor({ initial }: { initial: GenreConfig }) {
  const [config, setConfig] = useState<GenreConfig>(initial)
  const [saving, setSaving] = useState(false)
  const locale = useLocale()
  const isArabic = locale === 'ar'

  const dirty = JSON.stringify(config) !== JSON.stringify(initial)

  async function onSave() {
    setSaving(true)
    const result = await updateGenreConfig(config)
    setSaving(false)
    if (result.success) toast.success(isArabic ? 'تم حفظ ألوان الأنواع' : 'Genre colors saved')
    else toast.error(result.error ?? (isArabic ? 'تعذّر الحفظ' : 'Failed to save'))
  }

  function setColor(genre: string, color: string | undefined) {
    setConfig((c) => {
      const next = { ...c }
      const current = { ...(next[genre] ?? {}) }
      if (color === undefined) delete current.color
      else current.color = color
      if (Object.keys(current).length === 0) delete next[genre]
      else next[genre] = current
      return next
    })
  }

  return (
    <SettingsCard
      title={isArabic ? 'ألوان الأنواع' : 'Genre colors'}
      description={isArabic
        ? 'استبدل لون التمييز المستخدم لكل بطاقة نوع في الصفحة الرئيسية. الأنواع بدون استبدال تعود إلى اللوحة الافتراضية.'
        : 'Override the accent color used for each genre card on the landing page. Genres without an override fall back to the default palette.'}
      action={
        <Button size="sm" onClick={onSave} disabled={!dirty || saving}>
          {saving ? <Loader2 className="size-4 animate-spin" /> : (isArabic ? 'حفظ' : 'Save')}
        </Button>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        {KNOWN_GENRES.map((genre) => {
          const active = config[genre]?.color
          return (
            <div
              key={genre}
              className="flex items-center justify-between gap-3 rounded-[6px] border border-white/8 bg-[var(--bg-2)] px-3 py-2"
            >
              <span className="text-sm font-medium text-white">{genre}</span>
              <div className="flex items-center gap-1">
                {PRESETS.map((p) => (
                  <button
                    key={p.value}
                    type="button"
                    title={p.label}
                    onClick={() => setColor(genre, p.value)}
                    className={`size-6 rounded-full ring-2 ring-offset-2 ring-offset-black transition-all ${
                      active === p.value ? 'ring-white' : 'ring-transparent hover:ring-white/30'
                    }`}
                    style={{ background: p.value }}
                  />
                ))}
                <button
                  type="button"
                  title={isArabic ? 'إلغاء الاستبدال' : 'Clear override'}
                  onClick={() => setColor(genre, undefined)}
                  className={`ms-1 rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wider transition-colors ${
                    active
                      ? 'bg-white/10 text-white hover:bg-white/20'
                      : 'text-white/30'
                  }`}
                >
                  {isArabic ? 'افتراضي' : 'Default'}
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </SettingsCard>
  )
}
