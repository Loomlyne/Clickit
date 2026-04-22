'use client'

import { useState } from 'react'
import { useLocale } from 'next-intl'
import { toast } from 'sonner'
// lucide-react 1.7.0 removed brand-specific icons (Instagram/Twitter/Youtube)
// for licensing reasons. Use neutral icons for the editor labels — the actual
// footer still renders custom brand SVG icons.
import { Loader2, AtSign, PlaySquare, Music2, Camera } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { updateFooterContent } from '@/app/[locale]/admin/actions'
import type { FooterContent } from '@/lib/config'
import { SettingsCard, SettingsField } from './settings-card'

export function FooterEditor({ initial }: { initial: FooterContent }) {
  const [v, setV] = useState<FooterContent>(initial)
  const [saving, setSaving] = useState(false)
  const locale = useLocale()
  const isArabic = locale === 'ar'

  // Stringify for cheap dirty-check — fine at this scale (<1KB of JSON)
  const dirty = JSON.stringify(v) !== JSON.stringify(initial)

  async function onSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const result = await updateFooterContent(v)
    setSaving(false)
    if (result.success) toast.success(isArabic ? 'تم حفظ التذييل' : 'Footer saved')
    else toast.error(result.error ?? (isArabic ? 'تعذّر الحفظ' : 'Failed to save'))
  }

  return (
    <SettingsCard
      title={isArabic ? 'التذييل' : 'Footer'}
      description={isArabic
        ? 'الشعار وروابط التواصل وروابط الصفحات القانونية المعروضة في تذييل الموقع.'
        : 'Tagline, social links, and legal page URLs displayed in the site footer.'}
    >
      <form onSubmit={onSave} className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2">
          <SettingsField label={isArabic ? 'شعار التذييل' : 'Footer tagline'}>
            <Textarea
              rows={2}
              maxLength={300}
              value={v.tagline}
              onChange={(e) => setV({ ...v, tagline: e.target.value })}
            />
          </SettingsField>
          <SettingsField label={isArabic ? 'إحصائية المكتبة' : 'Catalog stat'} hint={isArabic ? 'مثلاً: "15 برنامجاً أصلياً"' : 'e.g. "15 original programs"'}>
            <Input
              maxLength={80}
              value={v.stat}
              onChange={(e) => setV({ ...v, stat: e.target.value })}
            />
          </SettingsField>
          <SettingsField label={isArabic ? 'البريد الإلكتروني للتواصل' : 'Contact email'} hint={isArabic ? 'اتركه فارغاً للإخفاء.' : 'Leave blank to hide.'}>
            <Input
              type="email"
              value={v.contactEmail}
              onChange={(e) => setV({ ...v, contactEmail: e.target.value })}
              placeholder="hello@clickitstory.com"
            />
          </SettingsField>
        </div>

        <fieldset className="space-y-3">
          <legend className="text-xs font-medium uppercase tracking-[0.16em] text-white/60">
            {isArabic ? 'روابط التواصل الاجتماعي' : 'Social links'}
          </legend>
          <div className="grid gap-3 md:grid-cols-2">
            <SocialInput
              icon={<Camera className="size-4" />}
              label="Instagram"
              value={v.social.instagram}
              onChange={(value) => setV({ ...v, social: { ...v.social, instagram: value } })}
            />
            <SocialInput
              icon={<AtSign className="size-4" />}
              label="X (Twitter)"
              value={v.social.x}
              onChange={(value) => setV({ ...v, social: { ...v.social, x: value } })}
            />
            <SocialInput
              icon={<PlaySquare className="size-4" />}
              label="YouTube"
              value={v.social.youtube}
              onChange={(value) => setV({ ...v, social: { ...v.social, youtube: value } })}
            />
            <SocialInput
              icon={<Music2 className="size-4" />}
              label="TikTok"
              value={v.social.tiktok}
              onChange={(value) => setV({ ...v, social: { ...v.social, tiktok: value } })}
            />
          </div>
        </fieldset>

        <fieldset className="space-y-3">
          <legend className="text-xs font-medium uppercase tracking-[0.16em] text-white/60">
            {isArabic ? 'الصفحات القانونية' : 'Legal pages'}
          </legend>
          <div className="grid gap-3 md:grid-cols-3">
            <SettingsField label={isArabic ? 'رابط سياسة الخصوصية' : 'Privacy Policy URL'}>
              <Input
                value={v.legal.privacy}
                onChange={(e) => setV({ ...v, legal: { ...v.legal, privacy: e.target.value } })}
                placeholder="/legal/privacy"
              />
            </SettingsField>
            <SettingsField label={isArabic ? 'رابط شروط الخدمة' : 'Terms of Service URL'}>
              <Input
                value={v.legal.terms}
                onChange={(e) => setV({ ...v, legal: { ...v.legal, terms: e.target.value } })}
                placeholder="/legal/terms"
              />
            </SettingsField>
            <SettingsField label={isArabic ? 'رابط سياسة ملفات الارتباط' : 'Cookie Policy URL'}>
              <Input
                value={v.legal.cookies}
                onChange={(e) => setV({ ...v, legal: { ...v.legal, cookies: e.target.value } })}
                placeholder="/legal/cookies"
              />
            </SettingsField>
          </div>
        </fieldset>

        <div className="flex items-center justify-end">
          <Button type="submit" disabled={!dirty || saving}>
            {saving ? <Loader2 className="size-4 animate-spin" /> : (isArabic ? 'حفظ التذييل' : 'Save footer')}
          </Button>
        </div>
      </form>
    </SettingsCard>
  )
}

function SocialInput({
  icon,
  label,
  value,
  onChange,
}: {
  icon: React.ReactNode
  label: string
  value: string
  onChange: (v: string) => void
}) {
  return (
    <label className="space-y-1.5">
      <span className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.16em] text-white/60">
        {icon}
        {label}
      </span>
      <Input
        type="url"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={`https://…/${label.toLowerCase().replace(/[^a-z]/g, '')}`}
      />
    </label>
  )
}
