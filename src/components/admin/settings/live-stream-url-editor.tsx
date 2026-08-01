'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { updateLiveStreamUrl } from '@/app/[locale]/admin/actions'
import { SettingsCard, SettingsField } from './settings-card'

export function LiveStreamUrlEditor({
  initialUrl,
  initialLabel,
  initialLabelAr,
}: {
  initialUrl: string | null
  initialLabel: string | null
  initialLabelAr: string | null
}) {
  const [url, setUrl] = useState(initialUrl ?? '')
  const [label, setLabel] = useState(initialLabel ?? '')
  const [labelAr, setLabelAr] = useState(initialLabelAr ?? '')
  const [saving, setSaving] = useState(false)
  const t = useTranslations('admin.settings')

  const dirty =
    url !== (initialUrl ?? '') ||
    label !== (initialLabel ?? '') ||
    labelAr !== (initialLabelAr ?? '')

  async function onSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const result = await updateLiveStreamUrl({
      live_stream_url: url === '' ? null : url,
      live_stream_label: label === '' ? null : label,
      live_stream_label_ar: labelAr === '' ? null : labelAr,
    })
    setSaving(false)
    if (result.success) {
      toast.success(t('liveStreamSaved'))
    } else {
      toast.error(result.error ?? t('saveFailed'))
    }
  }

  return (
    <SettingsCard
      title={t('liveStreamTitle')}
      description={t('liveStreamDescription')}
    >
      <form onSubmit={onSave} className="grid gap-4">
        <SettingsField label={t('liveStreamLabelLabel')} hint={t('liveStreamLabelHint')}>
          <Input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder={t('liveStreamLabelPlaceholder')}
            maxLength={40}
          />
        </SettingsField>
        <SettingsField
          label={t('liveStreamLabelArLabel')}
          hint={t('liveStreamLabelArHint')}
        >
          <Input
            value={labelAr}
            onChange={(e) => setLabelAr(e.target.value)}
            placeholder={t('liveStreamLabelArPlaceholder')}
            maxLength={40}
            dir="rtl"
          />
        </SettingsField>
        <SettingsField label={t('youtubeUrlLabel')} hint={t('liveStreamHint')}>
          <Input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://www.youtube.com/watch?v=… or https://youtu.be/…"
            maxLength={500}
            className="font-mono text-sm"
          />
        </SettingsField>
        <div className="flex justify-end">
          <Button type="submit" disabled={!dirty || saving}>
            {saving ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              t('saveLiveStream')
            )}
          </Button>
        </div>
      </form>
    </SettingsCard>
  )
}
