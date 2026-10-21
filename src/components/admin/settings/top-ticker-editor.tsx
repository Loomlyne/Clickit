'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { Loader2, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { updateTopTicker } from '@/app/[locale]/admin/actions'
import type { TopTickerConfig, TopTickerItem } from '@/lib/config'
import { SettingsCard, SettingsField } from './settings-card'
import { useSharedRowVersion } from '@/components/admin/row-version'

const emptyRow = (): TopTickerItem => ({
  tag: '',
  text: '',
  tag2: '',
})

export function TopTickerEditor({ initial }: { initial: TopTickerConfig }) {
  const [enabled, setEnabled] = useState(initial.enabled)
  const [rows, setRows] = useState<TopTickerItem[]>(
    initial.items.length > 0
      ? initial.items.map((r) => ({
          tag: r.tag,
          text: r.text,
          tag2: r.tag2 ?? '',
        }))
      : [emptyRow()]
  )
  const [saving, setSaving] = useState(false)
  const t = useTranslations('admin.settings')
  const version = useSharedRowVersion()

  const normalizedInitial = {
    enabled: initial.enabled,
    items: initial.items.map((r) => ({
      tag: r.tag.trim(),
      text: r.text.trim(),
      tag2: (r.tag2 ?? '').trim(),
    })),
  }
  const normalizedDraft = {
    enabled,
    items: rows
      .map((r) => ({
        tag: r.tag.trim(),
        text: r.text.trim(),
        tag2: (r.tag2 ?? '').trim(),
      }))
      .filter(
        (r) =>
          r.tag.length > 0 || r.text.length > 0 || (r.tag2 ?? '').length > 0
      ),
  }
  const dirty =
    JSON.stringify(normalizedDraft) !== JSON.stringify(normalizedInitial)

  async function onSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const items = rows
      .map((r) => ({
        tag: r.tag.trim(),
        text: r.text.trim(),
        tag2: r.tag2?.trim() || undefined,
      }))
      .filter(
        (r) =>
          r.tag.length > 0 ||
          r.text.length > 0 ||
          (r.tag2?.trim() ?? '').length > 0
      )
    const expected = version.expected()
    const result = await updateTopTicker({ enabled, items }, expected)
    setSaving(false)
    if (result.success) {
      version.saved(expected, result.updatedAt)
      const data: unknown = result.data
      const untranslated =
        data && typeof data === 'object' && 'untranslated' in data
          ? (data as { untranslated: unknown }).untranslated
          : 0
      if (typeof untranslated === 'number' && untranslated > 0) {
        toast.warning(t('newsTickerArabicMissing', { count: untranslated }))
      } else {
        toast.success(t('newsTickerSaved'))
      }
      if (items.length === 0) {
        setRows([emptyRow()])
      }
    } else {
      toast.error(result.error ?? t('saveFailed'))
    }
  }

  function addRow() {
    if (rows.length >= 12) return
    setRows((r) => [...r, emptyRow()])
  }

  function removeRow(index: number) {
    setRows((r) =>
      r.length <= 1 ? [emptyRow()] : r.filter((_, i) => i !== index)
    )
  }

  return (
    <SettingsCard
      title={t('topTickerTitle')}
      description={t('topTickerDescription')}
    >
      <form onSubmit={onSave} className="space-y-4">
        <label className="flex cursor-pointer items-center justify-between gap-4 rounded-lg border border-[var(--line)] bg-[var(--bg-2)] px-4 py-3">
          <div>
            <p className="text-sm font-medium text-[var(--text)]">
              {t('enableTicker')}
            </p>
            <p className="text-muted-foreground mt-0.5 text-xs">
              {t('enableTickerHint')}
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={enabled}
            onClick={() => setEnabled((v) => !v)}
            className={`relative mt-1 h-6 w-11 shrink-0 rounded-full transition-colors before:absolute before:inset-x-0 before:-inset-y-2.5 before:content-[''] ${
              enabled ? 'bg-white' : 'bg-[var(--bg-3)]'
            }`}
          >
            <span
              className={`absolute top-0.5 left-0.5 size-5 rounded-full bg-black shadow-sm transition-transform ${
                enabled ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </label>

        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[13px] font-medium text-[var(--text-dim)]">
              {t('tickerLinesHeading')}
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1"
              onClick={addRow}
              disabled={rows.length >= 12}
            >
              <Plus className="size-4" />
              {t('line')}
            </Button>
          </div>

          {rows.map((row, index) => (
            <div
              key={index}
              className="flex flex-col gap-3 rounded-lg border border-[var(--line)] bg-[var(--bg-2)] p-4"
            >
              <div className="flex flex-col gap-3 md:flex-row md:items-end">
                <div className="min-w-0 flex-1 md:max-w-[160px]">
                  <SettingsField label={t('tagLabel')}>
                    <Input
                      value={row.tag}
                      maxLength={24}
                      placeholder={t('tagPlaceholder')}
                      onChange={(e) =>
                        setRows((rs) =>
                          rs.map((x, i) =>
                            i === index ? { ...x, tag: e.target.value } : x
                          )
                        )
                      }
                      className="rounded-lg font-[family-name:var(--font-lbc)] text-sm font-bold"
                    />
                  </SettingsField>
                </div>
                <div className="min-w-0 flex-[2]">
                  <SettingsField label={t('textLabel')}>
                    <Input
                      value={row.text}
                      maxLength={240}
                      placeholder={t('tickerMessagePlaceholder')}
                      onChange={(e) =>
                        setRows((rs) =>
                          rs.map((x, i) =>
                            i === index ? { ...x, text: e.target.value } : x
                          )
                        )
                      }
                      className="rounded-lg font-[family-name:var(--font-lbc)] font-bold"
                    />
                  </SettingsField>
                </div>
                <div className="min-w-0 flex-1 md:max-w-[160px]">
                  <SettingsField label={t('tagLabel')}>
                    <Input
                      value={row.tag2 ?? ''}
                      maxLength={24}
                      placeholder={t('tagPlaceholder')}
                      onChange={(e) =>
                        setRows((rs) =>
                          rs.map((x, i) =>
                            i === index ? { ...x, tag2: e.target.value } : x
                          )
                        )
                      }
                      className="rounded-lg font-[family-name:var(--font-lbc)] text-sm font-bold"
                    />
                  </SettingsField>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="hover:text-brand-red-safe shrink-0 text-[var(--text-mute)]"
                  aria-label={t('removeLineAria')}
                  onClick={() => removeRow(index)}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>

        <div className="flex justify-end">
          <Button type="submit" disabled={!dirty || saving}>
            {saving ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              t('saveTicker')
            )}
          </Button>
        </div>
      </form>
    </SettingsCard>
  )
}
