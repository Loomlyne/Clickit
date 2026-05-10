'use client'

import { useState } from 'react'
import { useLocale } from 'next-intl'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { updateLiveStreamUrl } from '@/app/[locale]/admin/actions'
import { SettingsCard, SettingsField } from './settings-card'

export function LiveStreamUrlEditor({ initialUrl }: { initialUrl: string | null }) {
  const [value, setValue] = useState(initialUrl ?? '')
  const [saving, setSaving] = useState(false)
  const locale = useLocale()
  const isArabic = locale === 'ar'

  const dirty = value !== (initialUrl ?? '')

  async function onSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const result = await updateLiveStreamUrl({
      live_stream_url: value === '' ? null : value,
    })
    setSaving(false)
    if (result.success) {
      toast.success(isArabic ? 'تم حفظ رابط البث' : 'Live stream URL saved')
    } else {
      toast.error(result.error ?? (isArabic ? 'تعذّر الحفظ' : 'Failed to save'))
    }
  }

  return (
    <SettingsCard
      title={isArabic ? 'البث المباشر' : 'Live stream (YouTube URL)'}
      description={isArabic
        ? 'يظهر زر «يُبث الآن» في شريط التنقل ويفتح الرابط في نافذة جديدة.'
        : 'The red “Now Live” control in the navbar uses this URL in a new tab. Leave empty to keep the default link to the watch page rail.'}
    >
      <form onSubmit={onSave} className="grid gap-4">
        <SettingsField
          label={isArabic ? 'رابط يوتيوب' : 'YouTube URL'}
          hint={isArabic
            ? 'يجب أن يكون الرابط من youtube.com أو youtu.be مع معرف فيديو صالح.'
            : 'Must be a full YouTube watch, live, shorts, or embed URL (validated host + video id).'}
        >
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
            {saving ? <Loader2 className="size-4 animate-spin" /> : (isArabic ? 'حفظ' : 'Save live URL')}
          </Button>
        </div>
      </form>
    </SettingsCard>
  )
}
