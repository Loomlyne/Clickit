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
}: {
  initialUrl: string | null
}) {
  const [value, setValue] = useState(initialUrl ?? '')
  const [saving, setSaving] = useState(false)
  const t = useTranslations('admin.settings')

  const dirty = value !== (initialUrl ?? '')

  async function onSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const result = await updateLiveStreamUrl({
      live_stream_url: value === '' ? null : value,
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
        <SettingsField label={t('youtubeUrlLabel')} hint={t('liveStreamHint')}>
          <Input
            value={value}
            onChange={(e) => setValue(e.target.value)}
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
              t('saveLiveUrl')
            )}
          </Button>
        </div>
      </form>
    </SettingsCard>
  )
}
