'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { useArabicMissingToast } from '@/components/admin/arabic-missing-toast'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { updateAuthPageConfig } from '@/app/[locale]/admin/actions'
import { SettingsCard, SettingsField } from './settings-card'
import { useSharedRowVersion } from '@/components/admin/row-version'

type Values = {
  auth_heading: string
  auth_heading_ar: string
  auth_subheading: string
  auth_subheading_ar: string
  auth_quote: string
  auth_quote_ar: string
  auth_quote_attribution: string
  auth_quote_attribution_ar: string
  auth_allow_skip: boolean
}

export function AuthPageEditor({ initial }: { initial: Values }) {
  const t = useTranslations('admin.settings')
  const warnArabicMissing = useArabicMissingToast()
  const version = useSharedRowVersion()
  const [values, setValues] = useState<Values>(initial)
  const [saving, setSaving] = useState(false)

  const dirty = (Object.keys(values) as (keyof Values)[]).some(
    (k) => values[k] !== initial[k]
  )

  function set<K extends keyof Values>(key: K, val: Values[K]) {
    setValues((v) => ({ ...v, [key]: val }))
  }

  async function onSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const expected = version.expected()
    const result = await updateAuthPageConfig(
      {
        auth_heading: values.auth_heading.trim() || null,
        auth_heading_ar: values.auth_heading_ar.trim() || null,
        auth_subheading: values.auth_subheading.trim() || null,
        auth_subheading_ar: values.auth_subheading_ar.trim() || null,
        auth_quote: values.auth_quote.trim() || null,
        auth_quote_ar: values.auth_quote_ar.trim() || null,
        auth_quote_attribution: values.auth_quote_attribution.trim() || null,
        auth_quote_attribution_ar:
          values.auth_quote_attribution_ar.trim() || null,
        auth_allow_skip: values.auth_allow_skip,
      },
      expected
    )
    setSaving(false)
    if (result.success) {
      version.saved(expected, result.updatedAt)
      if (!warnArabicMissing(result)) toast.success(t('authConfigSaved'))
    } else toast.error(result.error ?? t('saveFailed'))
  }

  return (
    <SettingsCard
      title={t('authCopyTitle')}
      description={t('authCopyDescription')}
    >
      <form onSubmit={onSave} className="grid gap-4 md:grid-cols-2">
        <SettingsField
          label={t('authHeadingLabel')}
          hint={t('authHeadingHint')}
        >
          <Input
            value={values.auth_heading}
            onChange={(e) => set('auth_heading', e.target.value)}
            placeholder="Welcome back."
            maxLength={120}
          />
        </SettingsField>
        <SettingsField label={t('authHeadingArLabel')}>
          <Input
            dir="rtl"
            value={values.auth_heading_ar}
            onChange={(e) => set('auth_heading_ar', e.target.value)}
            placeholder="مرحبًا بعودتك."
            maxLength={120}
          />
        </SettingsField>

        <SettingsField
          label={t('authSubheadingLabel')}
          hint={t('authSubheadingHint')}
        >
          <Input
            value={values.auth_subheading}
            onChange={(e) => set('auth_subheading', e.target.value)}
            placeholder="Resume watching. New here? Sign up below."
            maxLength={300}
          />
        </SettingsField>
        <SettingsField label={t('authSubheadingArLabel')}>
          <Input
            dir="rtl"
            value={values.auth_subheading_ar}
            onChange={(e) => set('auth_subheading_ar', e.target.value)}
            maxLength={300}
          />
        </SettingsField>

        <SettingsField label={t('authQuoteLabel')} hint={t('authQuoteHint')}>
          <Textarea
            value={values.auth_quote}
            onChange={(e) => set('auth_quote', e.target.value)}
            rows={3}
            maxLength={400}
            className="rounded-lg"
          />
        </SettingsField>
        <SettingsField label={t('authQuoteArLabel')}>
          <Textarea
            dir="rtl"
            value={values.auth_quote_ar}
            onChange={(e) => set('auth_quote_ar', e.target.value)}
            rows={3}
            maxLength={400}
            className="rounded-lg"
          />
        </SettingsField>

        <SettingsField label={t('authQuoteAttributionLabel')}>
          <Input
            value={values.auth_quote_attribution}
            onChange={(e) => set('auth_quote_attribution', e.target.value)}
            placeholder="Early beta subscriber"
            maxLength={120}
          />
        </SettingsField>
        <SettingsField label={t('authQuoteAttributionArLabel')}>
          <Input
            dir="rtl"
            value={values.auth_quote_attribution_ar}
            onChange={(e) => set('auth_quote_attribution_ar', e.target.value)}
            maxLength={120}
          />
        </SettingsField>

        {/* Skip sign-in toggle */}
        <div className="md:col-span-2">
          <div className="flex items-center justify-between gap-4 rounded-lg border border-[var(--line)] bg-[var(--bg-2)] p-4">
            <div>
              <p className="text-sm font-medium text-[var(--text)]">
                {t('authAllowSkipLabel')}
              </p>
              <p className="text-muted-foreground text-xs">
                {t('authAllowSkipHint')}
              </p>
            </div>
            <button
              type="button"
              onClick={() => set('auth_allow_skip', !values.auth_allow_skip)}
              aria-pressed={values.auth_allow_skip}
              aria-label={t('authAllowSkipLabel')}
              className={`relative h-6 w-11 shrink-0 rounded-full transition-colors before:absolute before:inset-x-0 before:-inset-y-2.5 before:content-[''] focus-visible:ring-2 focus-visible:ring-white/50 focus-visible:outline-none ${
                values.auth_allow_skip
                  ? 'bg-brand-green-safe'
                  : 'bg-[var(--bg-3)]'
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 size-5 rounded-full bg-white shadow transition-transform ${
                  values.auth_allow_skip ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </div>

        <div className="flex items-center justify-end md:col-span-2">
          <Button type="submit" disabled={!dirty || saving}>
            {saving ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              t('saveButton')
            )}
          </Button>
        </div>
      </form>
    </SettingsCard>
  )
}
