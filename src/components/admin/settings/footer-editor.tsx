'use client'

import { useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import Image from 'next/image'
import { Loader2, Plus, Trash2, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  updateFooterContent,
  uploadSocialIcon,
} from '@/app/[locale]/admin/actions'
import type { FooterContent, SocialLinkItem } from '@/lib/config'
import { SOCIAL_PLATFORMS } from '@/lib/social-platforms'
import { stripStorageCacheBust } from '@/lib/supabase-media'
import { SettingsCard, SettingsField } from './settings-card'

export function FooterEditor({ initial }: { initial: FooterContent }) {
  const [v, setV] = useState<FooterContent>(initial)
  const [saving, setSaving] = useState(false)
  const t = useTranslations('admin.settings')

  const dirty = JSON.stringify(v) !== JSON.stringify(initial)

  function addRow() {
    setV((prev) => ({
      ...prev,
      social: [
        ...prev.social,
        { platform: SOCIAL_PLATFORMS[0].id, url: '', iconUrl: '' },
      ],
    }))
  }

  function removeRow(index: number) {
    setV((prev) => ({
      ...prev,
      social: prev.social.filter((_, i) => i !== index),
    }))
  }

  function updateRow(index: number, patch: Partial<SocialLinkItem>) {
    setV((prev) => ({
      ...prev,
      social: prev.social.map((row, i) =>
        i === index ? { ...row, ...patch } : row
      ),
    }))
  }

  async function onSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const result = await updateFooterContent(v)
    setSaving(false)
    if (result.success) toast.success(t('footerSaved'))
    else toast.error(result.error ?? t('saveFailed'))
  }

  return (
    <SettingsCard title={t('footerTitle')} description={t('footerDescription')}>
      <form onSubmit={onSave} className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2">
          <SettingsField label={t('footerTaglineLabel')}>
            <Textarea
              rows={2}
              maxLength={300}
              value={v.tagline}
              onChange={(e) => setV({ ...v, tagline: e.target.value })}
              className="rounded-lg"
            />
          </SettingsField>
          <SettingsField
            label={t('footerTaglineArLabel')}
            hint={t('footerTaglineArHint')}
          >
            <Textarea
              dir="rtl"
              rows={2}
              maxLength={300}
              value={v.taglineAr}
              onChange={(e) => setV({ ...v, taglineAr: e.target.value })}
              className="rounded-lg"
              placeholder="من الإمارات إلى العالم…"
            />
          </SettingsField>
          <SettingsField
            label={t('contactEmailLabel')}
            hint={t('contactEmailHint')}
          >
            <Input
              type="email"
              value={v.contactEmail}
              onChange={(e) => setV({ ...v, contactEmail: e.target.value })}
              placeholder="hello@clickitstory.com"
              className="rounded-lg"
            />
          </SettingsField>
        </div>

        {/* Social links — dynamic rows */}
        <fieldset className="space-y-3">
          <legend className="text-[13px] font-medium text-[var(--text-dim)]">
            {t('socialLinksHeading')}
          </legend>

          <div className="space-y-2">
            {v.social.map((row, index) => {
              const platform =
                SOCIAL_PLATFORMS.find((p) => p.id === row.platform) ??
                SOCIAL_PLATFORMS[0]
              const Icon = platform.Icon
              return (
                <div key={index} className="flex items-center gap-2">
                  {/* Icon upload */}
                  <SocialIconUpload
                    currentUrl={row.iconUrl ?? ''}
                    onUploaded={(url) => updateRow(index, { iconUrl: url })}
                    onRemove={() => updateRow(index, { iconUrl: '' })}
                  />

                  {/* Platform picker */}
                  <Select
                    value={row.platform}
                    onValueChange={(val) => updateRow(index, { platform: val })}
                  >
                    <SelectTrigger className="w-[180px] shrink-0 rounded-lg">
                      <SelectValue>
                        <span className="flex items-center gap-2">
                          <Icon className="size-4 shrink-0" />
                          {platform.label}
                        </span>
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {SOCIAL_PLATFORMS.map((p) => {
                        const PIcon = p.Icon
                        return (
                          <SelectItem key={p.id} value={p.id}>
                            <span className="flex items-center gap-2">
                              <PIcon className="size-4 shrink-0" />
                              {p.label}
                            </span>
                          </SelectItem>
                        )
                      })}
                    </SelectContent>
                  </Select>

                  {/* URL input */}
                  <Input
                    type="url"
                    value={row.url}
                    onChange={(e) => updateRow(index, { url: e.target.value })}
                    placeholder="https://…"
                    className="min-w-0 flex-1 rounded-lg"
                  />

                  {/* Remove row */}
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="hover:text-brand-red-safe shrink-0 text-[var(--text-mute)]"
                    onClick={() => removeRow(index)}
                    aria-label="Remove"
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              )
            })}
          </div>

          {v.social.length < 20 && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-1 rounded-full"
              onClick={addRow}
            >
              <Plus className="me-1.5 size-3.5" />
              Add social link
            </Button>
          )}
        </fieldset>

        <fieldset className="space-y-3">
          <legend className="text-[13px] font-medium text-[var(--text-dim)]">
            {t('legalPagesHeading')}
          </legend>
          <div className="grid gap-3 md:grid-cols-3">
            <SettingsField label={t('privacyUrlLabel')}>
              <Input
                value={v.legal.privacy}
                onChange={(e) =>
                  setV({ ...v, legal: { ...v.legal, privacy: e.target.value } })
                }
                placeholder="/legal/privacy"
              />
            </SettingsField>
            <SettingsField label={t('termsUrlLabel')}>
              <Input
                value={v.legal.terms}
                onChange={(e) =>
                  setV({ ...v, legal: { ...v.legal, terms: e.target.value } })
                }
                placeholder="/legal/terms"
              />
            </SettingsField>
            <SettingsField label={t('cookiesUrlLabel')}>
              <Input
                value={v.legal.cookies}
                onChange={(e) =>
                  setV({ ...v, legal: { ...v.legal, cookies: e.target.value } })
                }
                placeholder="/legal/cookies"
              />
            </SettingsField>
          </div>
        </fieldset>

        <div className="flex items-center justify-end">
          <Button type="submit" disabled={!dirty || saving}>
            {saving ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              t('saveFooter')
            )}
          </Button>
        </div>
      </form>
    </SettingsCard>
  )
}

function SocialIconUpload({
  currentUrl,
  onUploaded,
  onRemove,
}: {
  currentUrl: string
  onUploaded: (url: string) => void
  onRemove: () => void
}) {
  const [busy, setBusy] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setBusy(true)
    try {
      const fd = new FormData()
      fd.set('file', file)
      const result = await uploadSocialIcon(fd)
      if (!result.success) {
        toast.error(result.error ?? 'Upload failed')
        return
      }
      onUploaded(result.data ?? '')
    } finally {
      setBusy(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  return (
    <div className="shrink-0">
      {currentUrl ? (
        <button
          type="button"
          onClick={onRemove}
          className="group relative flex size-9 items-center justify-center rounded-field border border-[var(--line)] bg-black/30 after:absolute after:-inset-1 after:content-['']"
          title="Remove icon"
        >
          <span className="flex size-full items-center justify-center overflow-hidden rounded-field">
            <Image
              src={stripStorageCacheBust(currentUrl) ?? currentUrl}
              alt="icon"
              width={24}
              height={24}
              unoptimized
              className="size-6 object-contain transition-opacity group-hover:opacity-20"
            />
          </span>
          <Trash2 className="text-brand-red-safe absolute size-3.5 opacity-0 transition-opacity group-hover:opacity-100" />
        </button>
      ) : (
        <label
          className="relative flex size-9 cursor-pointer items-center justify-center rounded-field border border-dashed border-[var(--line-2)] bg-[var(--bg-2)] text-[var(--text-mute)] transition-colors after:absolute after:-inset-1 after:content-[''] hover:border-[var(--text-mute)] hover:text-[var(--text-dim)]"
          title="Upload icon"
        >
          {busy ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Upload className="size-3.5" />
          )}
          <input
            ref={inputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={onFile}
          />
        </label>
      )}
    </div>
  )
}
