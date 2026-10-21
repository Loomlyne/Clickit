'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { updateGenreConfig } from '@/app/[locale]/admin/actions'
import type { GenreConfig } from '@/lib/config'
import { BRAND_PALETTE } from '@/lib/brand-colors'
import { SettingsCard } from './settings-card'
import { useSharedRowVersion } from '@/components/admin/row-version'

/**
 * Genre color overrides — maps genre name to a brand-palette color.
 * The hardcoded GENRE_COLORS map in src/components/home/genres-grid.tsx
 * still serves as the fallback when a genre has no override.
 *
 * Kept intentionally minimal: preset picker + optional "hidden" toggle.
 * Custom hex entry is out of scope — CIT branding guideline limits the
 * palette to six colors.
 */

const PRESET_LABELS: Record<string, string> = {
  'brand-blue': 'Blue',
  'brand-purple': 'Purple',
  'brand-green': 'Green',
  'brand-red': 'Red',
  'brand-orange': 'Orange',
  'brand-yellow': 'Yellow',
}

const PRESETS: Array<{ label: string; value: string }> = BRAND_PALETTE.map((p) => ({
  label: PRESET_LABELS[p.key],
  value: p.hex,
}))

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
  const t = useTranslations('admin.settings')
  const version = useSharedRowVersion()

  const dirty = JSON.stringify(config) !== JSON.stringify(initial)

  async function onSave() {
    setSaving(true)
    const expected = version.expected()
    const result = await updateGenreConfig(config, expected)
    setSaving(false)
    if (result.success) {
      version.saved(expected, result.updatedAt)
      toast.success(t('genreColorsSaved'))
    } else toast.error(result.error ?? t('saveFailed'))
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
      title={t('genreColorsTitle')}
      description={t('genreColorsDescription')}
      action={
        <Button size="sm" onClick={onSave} disabled={!dirty || saving}>
          {saving ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            t('saveButtonShort')
          )}
        </Button>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        {KNOWN_GENRES.map((genre) => {
          const active = config[genre]?.color
          return (
            <div
              key={genre}
              className="flex items-center justify-between gap-3 rounded-lg border border-[var(--line)] bg-[var(--bg-2)] px-3 py-2"
            >
              <span className="text-sm font-medium text-[var(--text)]">
                {genre}
              </span>
              <div className="flex items-center gap-2">
                {PRESETS.map((p) => (
                  <button
                    key={p.value}
                    type="button"
                    title={p.label}
                    onClick={() => setColor(genre, p.value)}
                    className={`relative size-9 rounded-full ring-2 ring-offset-2 ring-offset-black transition-all after:absolute after:-inset-1 after:content-[''] ${
                      active === p.value
                        ? 'ring-white'
                        : 'ring-transparent hover:ring-white/30'
                    }`}
                    style={{ background: p.value }}
                  />
                ))}
                <button
                  type="button"
                  title={t('clearOverride')}
                  onClick={() => setColor(genre, undefined)}
                  className={`relative ms-1 min-h-9 rounded-full px-3 text-[11px] tracking-wider uppercase transition-colors after:absolute after:inset-x-0 after:-inset-y-1 after:content-[''] ${
                    active
                      ? 'bg-[var(--bg-3)] text-[var(--text)] hover:bg-[var(--bg-3)]'
                      : 'text-[var(--text-mute)]'
                  }`}
                >
                  {t('defaultLabel')}
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </SettingsCard>
  )
}
