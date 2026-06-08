'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import {
  Loader2,
  LayoutGrid,
  Megaphone,
  HelpCircle,
  Moon,
  RefreshCw,
  AlertTriangle,
  ExternalLink,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  updateFeatureFlags,
  revalidateAllCache,
  updateIntegrations,
} from '@/app/[locale]/admin/actions'
import type { AppConfig, FeatureFlags } from '@/lib/config'
import { SettingsCard, SettingsField } from './settings-card'
import { SecretField } from './secret-field'

type FlagMeta = {
  key: keyof FeatureFlags
  title: string
  description: string
  icon: React.ReactNode
  warning?: string
}

function getFlags(t: ReturnType<typeof useTranslations>): FlagMeta[] {
  return [
    {
      key: 'showGenresGrid',
      title: t('flagGenresTitle'),
      description: t('flagGenresDescription'),
      icon: <LayoutGrid className="size-4" />,
    },
    {
      key: 'showCtaBanner',
      title: t('flagCtaTitle'),
      description: t('flagCtaDescription'),
      icon: <Megaphone className="size-4" />,
    },
    {
      key: 'showFaq',
      title: t('flagFaqTitle'),
      description: t('flagFaqDescription'),
      icon: <HelpCircle className="size-4" />,
    },
    {
      key: 'comingSoonMode',
      title: t('flagComingSoonTitle'),
      description: t('flagComingSoonDescription'),
      icon: <Moon className="size-4" />,
      warning: t('flagComingSoonWarning'),
    },
  ]
}

export function AdvancedTab({
  config,
  hasYouTubeKey,
}: {
  config: AppConfig
  hasYouTubeKey: boolean
}) {
  const [flags, setFlags] = useState<FeatureFlags>(config.flags)
  const [saving, setSaving] = useState(false)
  const [revalidating, setRevalidating] = useState(false)

  const [ga, setGa] = useState(config.googleAnalyticsId ?? '')
  const [pixel, setPixel] = useState(config.metaPixelId ?? '')
  const [yt, setYt] = useState('')
  const [savedHasYouTube, setSavedHasYouTube] = useState(hasYouTubeKey)
  const [savingIntegrations, setSavingIntegrations] = useState(false)

  const t = useTranslations('admin.settings')
  const FLAGS = getFlags(t)

  const dirty = JSON.stringify(flags) !== JSON.stringify(config.flags)

  async function onSaveFlags() {
    setSaving(true)
    const result = await updateFeatureFlags(flags)
    setSaving(false)
    if (result.success) toast.success(t('featureFlagsSaved'))
    else toast.error(result.error ?? t('saveFailed'))
  }

  async function onRevalidate() {
    setRevalidating(true)
    const result = await revalidateAllCache()
    setRevalidating(false)
    if (result.success) toast.success(t('cacheRefreshed'))
    else toast.error(result.error ?? t('revalidateFailed'))
  }

  async function onSaveIntegrations(e: React.SyntheticEvent) {
    e.preventDefault()
    setSavingIntegrations(true)
    const result = await updateIntegrations({
      google_analytics_id: ga.trim() || null,
      meta_pixel_id: pixel.trim() || null,
      youtube_api_key: yt === '' ? null : yt.trim(),
    })
    setSavingIntegrations(false)
    if (result.success) {
      toast.success(t('integrationsSaved'))
      if (yt !== '') setSavedHasYouTube(true)
      else if (yt === '' && !savedHasYouTube) setSavedHasYouTube(false)
    } else {
      toast.error(result.error ?? t('saveFailed'))
    }
  }

  return (
    <>
      <SettingsCard
        title={t('featureFlagsTitle')}
        description={t('featureFlagsDescription')}
        action={
          <Button size="sm" onClick={onSaveFlags} disabled={!dirty || saving}>
            {saving ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              t('saveFlags')
            )}
          </Button>
        }
      >
        <div className="space-y-2">
          {FLAGS.map((flag) => (
            <FlagRow
              key={flag.key}
              meta={flag}
              value={flags[flag.key]}
              onChange={(v) => setFlags((f) => ({ ...f, [flag.key]: v }))}
            />
          ))}
        </div>
      </SettingsCard>

      <form onSubmit={onSaveIntegrations} className="space-y-6">
        <SettingsCard
          title="Google Analytics"
          description={t('googleAnalyticsDescription')}
        >
          <SettingsField
            label={t('measurementIdLabel')}
            hint={t('measurementIdHint')}
          >
            <Input
              value={ga}
              onChange={(e) => setGa(e.target.value)}
              placeholder={t('measurementIdPlaceholder')}
              className="font-mono"
              maxLength={40}
            />
          </SettingsField>
        </SettingsCard>

        <SettingsCard
          title="Meta Pixel"
          description={t('metaPixelDescription')}
        >
          <SettingsField label={t('pixelIdLabel')} hint={t('pixelIdHint')}>
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
          description={t('youtubeApiDescription')}
          action={
            <a
              href="https://console.cloud.google.com/apis/credentials"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-xs font-medium text-white/60 hover:text-white"
            >
              {t('getKey')}
              <ExternalLink className="size-3" />
            </a>
          }
        >
          <SettingsField label={t('apiKeyLabel')} hint={t('apiKeyHint')}>
            <SecretField
              value={yt}
              onChange={setYt}
              hasSavedValue={savedHasYouTube}
              placeholder={t('apiKeyPlaceholder')}
            />
          </SettingsField>
        </SettingsCard>

        <div className="flex items-center justify-end">
          <Button type="submit" disabled={savingIntegrations}>
            {savingIntegrations ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              t('saveIntegrations')
            )}
          </Button>
        </div>
      </form>

      <SettingsCard title={t('cacheTitle')} description={t('cacheDescription')}>
        <Button
          variant="outline"
          onClick={onRevalidate}
          disabled={revalidating}
          className="gap-2"
        >
          {revalidating ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <RefreshCw className="size-4" />
          )}
          {t('revalidateAllCaches')}
        </Button>
      </SettingsCard>

      <SettingsCard
        title={t('adminAccountTitle')}
        description={t('adminAccountDescription')}
      >
        <div className="text-muted-foreground rounded-lg border border-white/8 bg-white/[0.02] px-4 py-3 font-mono text-xs">
          {t('adminAccountCurrent')}
        </div>
      </SettingsCard>
    </>
  )
}

function FlagRow({
  meta,
  value,
  onChange,
}: {
  meta: FlagMeta
  value: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4 rounded-lg border border-white/8 bg-white/[0.02] px-4 py-3 transition-colors hover:border-white/16">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex size-8 items-center justify-center rounded-full bg-white/[0.06] text-white/70">
          {meta.icon}
        </span>
        <div className="min-w-0">
          <p className="text-sm font-medium text-white">{meta.title}</p>
          <p className="text-muted-foreground mt-0.5 text-xs">
            {meta.description}
          </p>
          {meta.warning && value && (
            <p className="mt-1.5 flex items-center gap-1 text-xs text-orange-300">
              <AlertTriangle className="size-3.5" />
              {meta.warning}
            </p>
          )}
        </div>
      </div>
      <Toggle value={value} onChange={onChange} />
    </label>
  )
}

function Toggle({
  value,
  onChange,
}: {
  value: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={value}
      onClick={() => onChange(!value)}
      className={`relative mt-1 h-6 w-11 shrink-0 rounded-full transition-colors ${
        value ? 'bg-white' : 'bg-white/15'
      }`}
    >
      <span
        className={`absolute top-0.5 left-0.5 size-5 rounded-full bg-black shadow-sm transition-transform ${
          value ? 'translate-x-5' : 'translate-x-0'
        }`}
      />
    </button>
  )
}
