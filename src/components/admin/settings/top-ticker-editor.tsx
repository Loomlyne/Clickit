'use client'

import { useState } from 'react'
import { useLocale } from 'next-intl'
import { toast } from 'sonner'
import { Loader2, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { updateTopTicker } from '@/app/[locale]/admin/actions'
import type { TopTickerConfig, TopTickerItem } from '@/lib/config'
import { SettingsCard, SettingsField } from './settings-card'

const emptyRow = (): TopTickerItem => ({ tag: '', text: '' })

export function TopTickerEditor({ initial }: { initial: TopTickerConfig }) {
  const [enabled, setEnabled] = useState(initial.enabled)
  const [rows, setRows] = useState<TopTickerItem[]>(
    initial.items.length > 0 ? initial.items.map((r) => ({ ...r })) : [emptyRow()]
  )
  const [saving, setSaving] = useState(false)
  const locale = useLocale()
  const isArabic = locale === 'ar'

  const normalizedInitial = {
    enabled: initial.enabled,
    items: initial.items.map((r) => ({ tag: r.tag.trim(), text: r.text.trim() })),
  }
  const normalizedDraft = {
    enabled,
    items: rows
      .map((r) => ({ tag: r.tag.trim(), text: r.text.trim() }))
      .filter((r) => r.tag.length > 0 || r.text.length > 0),
  }
  const dirty =
    JSON.stringify(normalizedDraft) !== JSON.stringify(normalizedInitial)

  async function onSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const items = rows
      .map((r) => ({ tag: r.tag.trim(), text: r.text.trim() }))
      .filter((r) => r.tag.length > 0 || r.text.length > 0)
    const result = await updateTopTicker({ enabled, items })
    setSaving(false)
    if (result.success) {
      toast.success(isArabic ? 'تم حفظ الشريط الإخباري' : 'News ticker saved')
      if (items.length === 0) {
        setRows([emptyRow()])
      }
    } else {
      toast.error(result.error ?? (isArabic ? 'تعذّر الحفظ' : 'Failed to save'))
    }
  }

  function addRow() {
    if (rows.length >= 12) return
    setRows((r) => [...r, emptyRow()])
  }

  function removeRow(index: number) {
    setRows((r) => (r.length <= 1 ? [emptyRow()] : r.filter((_, i) => i !== index)))
  }

  return (
    <SettingsCard
      title={isArabic ? 'الشريط الإخباري (أعلى الشريط)' : 'Top news ticker'}
      description={isArabic
        ? 'شريط متحرك فوق شريط التنقل في صفحات المشاهد (مخفي على الصفحة الرئيسية والمعرض).'
        : 'Scrolling bar above the navbar on viewer pages (hidden on the landing/portfolio hero).'}
    >
      <form onSubmit={onSave} className="space-y-4">
        <label className="flex cursor-pointer items-center justify-between gap-4 rounded-lg border border-white/8 bg-white/[0.02] px-4 py-3">
          <div>
            <p className="text-sm font-medium text-white">
              {isArabic ? 'تفعيل الشريط' : 'Enable ticker'}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {isArabic
                ? 'عطّله لإخفاء الشريط بالكامل.'
                : 'Turn off to hide the bar everywhere it would appear.'}
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={enabled}
            onClick={() => setEnabled((v) => !v)}
            className={`relative mt-1 h-6 w-11 shrink-0 rounded-full transition-colors ${
              enabled ? 'bg-white' : 'bg-white/15'
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
            <span className="text-xs font-medium uppercase tracking-[0.16em] text-white/60">
              {isArabic ? 'الأسطر (حد أقصى 12)' : 'Lines (max 12)'}
            </span>
            <Button type="button" variant="outline" size="sm" className="gap-1" onClick={addRow} disabled={rows.length >= 12}>
              <Plus className="size-4" />
              {isArabic ? 'سطر' : 'Line'}
            </Button>
          </div>

          {rows.map((row, index) => (
            <div
              key={index}
              className="flex flex-col gap-3 rounded-lg border border-white/8 bg-white/[0.02] p-4 md:flex-row md:items-end"
            >
              <div className="min-w-0 flex-1 md:max-w-[180px]">
                <SettingsField label={isArabic ? 'الوسم' : 'Tag'}>
                  <Input
                    value={row.tag}
                    maxLength={24}
                    placeholder="NEW"
                    onChange={(e) =>
                      setRows((rs) =>
                        rs.map((x, i) => (i === index ? { ...x, tag: e.target.value } : x))
                      )
                    }
                    className="rounded-[12px] font-mono text-sm"
                  />
                </SettingsField>
              </div>
              <div className="min-w-0 flex-[2]">
                <SettingsField label={isArabic ? 'النص' : 'Text'}>
                  <Input
                    value={row.text}
                    maxLength={240}
                    placeholder={isArabic ? 'نص التذييل المتحرك' : 'Ticker message'}
                    onChange={(e) =>
                      setRows((rs) =>
                        rs.map((x, i) => (i === index ? { ...x, text: e.target.value } : x))
                      )
                    }
                    className="rounded-[12px]"
                  />
                </SettingsField>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="shrink-0 text-white/50 hover:text-red-300"
                aria-label={isArabic ? 'حذف السطر' : 'Remove line'}
                onClick={() => removeRow(index)}
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          ))}
        </div>

        <div className="flex justify-end">
          <Button type="submit" disabled={!dirty || saving}>
            {saving ? <Loader2 className="size-4 animate-spin" /> : isArabic ? 'حفظ الشريط' : 'Save ticker'}
          </Button>
        </div>
      </form>
    </SettingsCard>
  )
}
