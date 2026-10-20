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
import { useSharedRowVersion } from '@/components/admin/row-version'

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
  const [gaEnabled, setGaEnabled] = useState(Boolean(config.googleAnalyticsId))
  const [pixelEnabled, setPixelEnabled] = useState(Boolean(config.metaPixelId))
  const [ytEnabled, setYtEnabled] = useState(hasYouTubeKey)
  const [savingIntegrations, setSavingIntegrations] = useState(false)

  const t = useTranslations('admin.settings')
  const FLAGS = getFlags(t)
  const version = useSharedRowVersion()

  const dirty = JSON.stringify(flags) !== JSON.stringify(config.flags)

  async function onSaveFlags() {
    setSaving(true)
    const expected = version.expected()
    const result = await updateFeatureFlags(flags, expected)
    setSaving(false)
    if (result.success) {
      version.saved(expected, result.updatedAt)
      toast.success(t('featureFlagsSaved'))
    } else toast.error(result.error ?? t('saveFailed'))
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

    const gaValue = gaEnabled ? ga.trim() : ''
    const pixelValue = pixelEnabled ? pixel.trim() : ''

    if (gaEnabled && gaValue && !/^G-[A-Z0-9]{4,20}$/.test(gaValue)) {
      toast.error(t('invalidGoogleAnalyticsId'))
      return
    }
    if (pixelEnabled && pixelValue && !/^[0-9]{6,20}$/.test(pixelValue)) {
      toast.error(t('invalidMetaPixelId'))
      return
    }

    setSavingIntegrations(true)

    let youtubeApiKey: string | null | undefined
    if (!ytEnabled) {
      youtubeApiKey = null
    } else if (yt !== '') {
      youtubeApiKey = yt.trim()
    } else {
      youtubeApiKey = undefined
    }

    const expected = version.expected()
    const result = await updateIntegrations(
      {
        google_analytics_id: gaEnabled && gaValue ? gaValue : null,
        meta_pixel_id: pixelEnabled && pixelValue ? pixelValue : null,
        youtube_api_key: youtubeApiKey,
      },
      expected
    )
    setSavingIntegrations(false)
    if (result.success) {
      version.saved(expected, result.updatedAt)
      toast.success(t('integrationsSaved'))
      if (!ytEnabled) {
        setSavedHasYouTube(false)
      } else if (yt !== '') {
        setSavedHasYouTube(true)
      }
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
          title={t('analyticsTitle')}
          description={t('analyticsDescription')}
        >
          <div className="space-y-4">
            <IntegrationRow
              title="Google Analytics"
              description={t('googleAnalyticsDescription')}
              enabled={gaEnabled}
              onEnabledChange={setGaEnabled}
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
                  disabled={!gaEnabled}
                />
              </SettingsField>
            </IntegrationRow>

            <IntegrationRow
              title="Meta Pixel"
              description={t('metaPixelDescription')}
              enabled={pixelEnabled}
              onEnabledChange={setPixelEnabled}
            >
              <SettingsField label={t('pixelIdLabel')} hint={t('pixelIdHint')}>
                <Input
                  value={pixel}
                  onChange={(e) => setPixel(e.target.value)}
                  placeholder="1234567890"
                  className="font-mono"
                  maxLength={40}
                  disabled={!pixelEnabled}
                />
              </SettingsField>
            </IntegrationRow>

            <IntegrationRow
              title="YouTube Data API"
              description={t('youtubeApiDescription')}
              enabled={ytEnabled}
              onEnabledChange={setYtEnabled}
              action={
                <a
                  href="https://console.cloud.google.com/apis/credentials"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-xs font-medium text-[var(--text-dim)] hover:text-[var(--text)]"
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
                  disabled={!ytEnabled}
                />
              </SettingsField>
            </IntegrationRow>
          </div>
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
        <div className="text-muted-foreground rounded-lg border border-[var(--line)] bg-[var(--bg-2)] px-4 py-3 font-mono text-xs">
          {t('adminAccountCurrent')}
        </div>
      </SettingsCard>
    </>
  )
}

function IntegrationRow({
  title,
  description,
  enabled,
  onEnabledChange,
  children,
  action,
}: {
  title: string
  description: string
  enabled: boolean
  onEnabledChange: (v: boolean) => void
  children: React.ReactNode
  action?: React.ReactNode
}) {
  return (
    <div
      className={`rounded-lg border border-[var(--line)] bg-[var(--bg-2)] p-4 transition-opacity ${
        enabled ? '' : 'opacity-60'
      }`}
    >
      <div className="flex items-start gap-3">
        <Toggle value={enabled} onChange={onEnabledChange} />
        <div className="min-w-0 flex-1 space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-[var(--text)]">{title}</p>
              <p className="text-muted-foreground mt-0.5 text-xs">
                {description}
              </p>
            </div>
            {action}
          </div>
          {children}
        </div>
      </div>
    </div>
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
    <label className="flex cursor-pointer items-start justify-between gap-4 rounded-lg border border-[var(--line)] bg-[var(--bg-2)] px-4 py-3 transition-colors hover:border-[var(--line-2)]">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex size-8 items-center justify-center rounded-full bg-[var(--bg-3)] text-[var(--text-dim)]">
          {meta.icon}
        </span>
        <div className="min-w-0">
          <p className="text-sm font-medium text-[var(--text)]">{meta.title}</p>
          <p className="text-muted-foreground mt-0.5 text-xs">
            {meta.description}
          </p>
          {meta.warning && value && (
            <p className="text-brand-orange-safe mt-1.5 flex items-center gap-1 text-xs">
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
      className={`relative mt-1 h-6 w-11 shrink-0 rounded-full transition-colors before:absolute before:inset-x-0 before:-inset-y-2.5 before:content-[''] ${
        value ? 'bg-white' : 'bg-[var(--bg-3)]'
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
