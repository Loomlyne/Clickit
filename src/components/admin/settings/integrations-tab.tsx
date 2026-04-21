'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Loader2, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { updateIntegrations } from '@/app/[locale]/admin/actions'
import type { AppConfig } from '@/lib/config'
import { SettingsCard, SettingsField } from './settings-card'
import { SecretField } from './secret-field'

export function IntegrationsTab({
  config,
  hasYouTubeKey,
}: {
  config: AppConfig
  hasYouTubeKey: boolean
}) {
  const [ga, setGa] = useState(config.googleAnalyticsId ?? '')
  const [pixel, setPixel] = useState(config.metaPixelId ?? '')
  const [yt, setYt] = useState('')
  const [savedHasYouTube, setSavedHasYouTube] = useState(hasYouTubeKey)
  const [saving, setSaving] = useState(false)

  async function onSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const result = await updateIntegrations({
      google_analytics_id: ga.trim() || null,
      meta_pixel_id: pixel.trim() || null,
      // Only send YouTube key if user typed a new one; empty string means "no change".
      // To actively clear, user types something then clears it — we treat empty as no-op
      // UNLESS the user explicitly clicked "Replace" and left it blank. For simplicity
      // we send null only on an explicit clear flow (handled in SecretField via Replace).
      youtube_api_key: yt === '' ? null : yt.trim(),
    })
    setSaving(false)
    if (result.success) {
      toast.success('Integrations saved')
      if (yt !== '') setSavedHasYouTube(true)
      else if (yt === '' && !savedHasYouTube) setSavedHasYouTube(false)
    } else {
      toast.error(result.error ?? 'Failed to save')
    }
  }

  return (
    <form onSubmit={onSave} className="space-y-6">
      <SettingsCard
        title="Google Analytics"
        description="Paste your GA4 measurement ID to enable page-view tracking on the landing and browse pages."
      >
        <SettingsField
          label="Measurement ID"
          hint='Format: G-XXXXXXXXXX. Find it in Analytics → Admin → Data Streams.'
        >
          <Input
            value={ga}
            onChange={(e) => setGa(e.target.value)}
            placeholder="G-XXXXXXXXXX"
            className="font-mono"
            maxLength={40}
          />
        </SettingsField>
      </SettingsCard>

      <SettingsCard
        title="Meta Pixel"
        description="Track conversions and build retargeting audiences for Instagram / Facebook campaigns."
      >
        <SettingsField label="Pixel ID" hint="Numeric ID only (no brackets or quotes).">
          <Input
            value={pixel}
            onChange={(e) => setPixel(e.target.value)}
            placeholder="1234567890"
            className="font-mono"
            maxLength={40}
          />
        </SettingsField>
      </SettingsCard>

      <SettingsCard
        title="YouTube Data API"
        description="Optional. When set, the episode form gets a 'Fetch from YouTube' button that auto-fills title, thumbnail, and duration from any YouTube URL."
        action={
          <a
            href="https://console.cloud.google.com/apis/credentials"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-xs font-medium text-white/60 hover:text-white"
          >
            Get a key
            <ExternalLink className="size-3" />
          </a>
        }
      >
        <SettingsField
          label="API key"
          hint="Stored securely. Only server-side routes can read this value."
        >
          <SecretField
            value={yt}
            onChange={setYt}
            hasSavedValue={savedHasYouTube}
            placeholder="AIzaSy…"
          />
        </SettingsField>
      </SettingsCard>

      <div className="flex items-center justify-end">
        <Button type="submit" disabled={saving}>
          {saving ? <Loader2 className="size-4 animate-spin" /> : 'Save integrations'}
        </Button>
      </div>
    </form>
  )
}
