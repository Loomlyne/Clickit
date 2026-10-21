'use client'

import { useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { toast } from 'sonner'
import {
  Loader2,
  LayoutGrid,
  Megaphone,
  HelpCircle,
  Moon,
  RefreshCw,
  AlertTriangle,
  Check,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  updateFeatureFlags,
  revalidateAllCache,
  updateIntegrations,
  saveYouTubeApiKey,
  testYouTubeKey,
} from '@/app/[locale]/admin/actions'
import type { AppConfig, FeatureFlags } from '@/lib/config'
import { YouTubeStatusChip } from '@/components/admin/youtube-status-chip'
import { localeTag } from '@/lib/i18n-format'
import { YOUTUBE_ERROR_MESSAGE_KEYS } from '@/lib/youtube-errors'
import { formatQuotaReset, nextQuotaReset } from '@/lib/youtube-quota'
import { YOUTUBE_KEY_FORMAT } from '@/server/youtube/key'
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

/** What the settings page sends about the key: never the key itself. */
export type YouTubeKeyView = {
  hasKey: boolean
  last4: string | null
  lastTest: { at: string; ok: boolean; reason: string | null } | null
}

export function AdvancedTab({
  config,
  youtubeKey,
}: {
  config: AppConfig
  youtubeKey: YouTubeKeyView
}) {
  const [flags, setFlags] = useState<FeatureFlags>(config.flags)
  const [saving, setSaving] = useState(false)
  const [revalidating, setRevalidating] = useState(false)

  const [ga, setGa] = useState(config.googleAnalyticsId ?? '')
  const [pixel, setPixel] = useState(config.metaPixelId ?? '')
  const [gaEnabled, setGaEnabled] = useState(Boolean(config.googleAnalyticsId))
  const [pixelEnabled, setPixelEnabled] = useState(Boolean(config.metaPixelId))
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

    const result = await updateIntegrations({
      google_analytics_id: gaEnabled && gaValue ? gaValue : null,
      meta_pixel_id: pixelEnabled && pixelValue ? pixelValue : null,
    })
    setSavingIntegrations(false)
    if (result.success) {
      toast.success(t('integrationsSaved'))
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

      <YouTubeKeyBlock initial={youtubeKey} />

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

// ---------------------------------------------------------------------------
// YouTube key block (UI-SPEC §6, G6 pictures). Its own form, outside the
// integrations form. The browser only ever holds hasKey, last4 and the last
// test; the typed key lives in state until the save succeeds, then is cleared.
// ---------------------------------------------------------------------------

type LastTestView = {
  at: string
  ok: boolean
  reason: string | null
  resetAt?: string | null
  /** A plain line when the action itself failed (not a YouTube answer). */
  message?: string
}

type SaveLine = { kind: 'formatInvalid' } | { kind: 'saveFailed'; reason: string }

const KEY_BUTTON = 'min-h-11 w-full px-6 py-2 text-sm font-bold sm:w-auto'
const TEST_OK_ICON = 'text-status-success size-4 shrink-0'

function formatTestDate(at: string, locale: string): string {
  const d = new Date(at)
  if (Number.isNaN(d.getTime())) return ''
  return new Intl.DateTimeFormat(localeTag(locale), {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    timeZone: 'Asia/Dubai',
  }).format(d)
}

function YouTubeKeyBlock({ initial }: { initial: YouTubeKeyView }) {
  const t = useTranslations('admin.settings')
  const tErrors = useTranslations('errors')
  // The key comes from YOUTUBE_ERROR_MESSAGE_KEYS, so the typed translator is widened.
  const tYtErrors = useTranslations('admin.youtubeErrors') as unknown as (key: string) => string
  const locale = useLocale()

  const [last4, setLast4] = useState<string | null>(
    initial.hasKey ? (initial.last4 ?? '') : null
  )
  const [changing, setChanging] = useState(false)
  const [value, setValue] = useState('')
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [savedJust, setSavedJust] = useState(false)
  const [saveLine, setSaveLine] = useState<SaveLine | null>(null)
  const [lastTest, setLastTest] = useState<LastTestView | null>(initial.lastTest)

  const hasKey = last4 !== null
  const editing = !hasKey || changing
  const busy = saving || testing

  function reasonText(test: LastTestView): string {
    if (test.message) return test.message
    switch (test.reason) {
      case 'rejected':
        return t('testReason.rejected')
      case 'apiNotAllowed':
        return t('testReason.apiNotAllowed')
      case 'network':
        return t('testReason.network')
      case 'quota': {
        const reset = test.resetAt ? new Date(test.resetAt) : nextQuotaReset(new Date(test.at))
        return t('testReason.quota', { time: formatQuotaReset(reset, locale) })
      }
      case 'missing':
        return t('missingBody')
      default:
        return ''
    }
  }

  function failureReason(error: string | undefined): string {
    return error === 'Unauthorized' ? tErrors('forbidden') : ''
  }

  // "{reason}" may be empty: keep one space between the sentences.
  const tidy = (text: string) => text.replace(/\s{2,}/g, ' ').trim()

  async function onSaveKey(e: React.SyntheticEvent) {
    e.preventDefault()
    const typed = value.trim()
    if (!typed || busy) return
    // Cheap check before the round trip; the server checks again.
    if (!YOUTUBE_KEY_FORMAT.test(typed)) {
      setSaveLine({ kind: 'formatInvalid' })
      return
    }
    setSaving(true)
    setSaveLine(null)
    try {
      const r = await saveYouTubeApiKey(typed)
      if (r.success) {
        setLast4(r.data.last4)
        setValue('')
        setChanging(false)
        setSavedJust(true)
        // A new key has not been tested (UI-SPEC §6 rule).
        setLastTest(null)
      } else if ('code' in r && r.code === 'format_invalid') {
        setSaveLine({ kind: 'formatInvalid' })
      } else if ('code' in r && r.code === 'limited') {
        setSaveLine({ kind: 'saveFailed', reason: tErrors('rateLimit') })
      } else {
        setSaveLine({ kind: 'saveFailed', reason: failureReason(r.error) })
      }
    } catch {
      setSaveLine({ kind: 'saveFailed', reason: tErrors('networkError') })
    } finally {
      setSaving(false)
    }
  }

  async function onTestKey() {
    if (!hasKey || editing || busy) return
    setTesting(true)
    setSavedJust(false)
    try {
      const r = await testYouTubeKey()
      if (r.success) {
        setLastTest({
          at: r.data.at,
          ok: r.data.ok,
          reason: r.data.ok ? null : r.data.reason,
          resetAt: r.data.resetAt,
        })
      } else if (r.data?.code === 'rate_limited') {
        // Not a key failure: the last-test line stays as it was.
        toast.error(tYtErrors(YOUTUBE_ERROR_MESSAGE_KEYS.rate_limited))
      } else {
        setLastTest({
          at: new Date().toISOString(),
          ok: false,
          reason: null,
          message: failureReason(r.error) || t('testReason.network'),
        })
      }
    } catch {
      setLastTest({
        at: new Date().toISOString(),
        ok: false,
        reason: 'network',
      })
    } finally {
      setTesting(false)
    }
  }

  const testFailed = hasKey && lastTest !== null && !lastTest.ok

  let row3: React.ReactNode
  if (testing) {
    row3 = (
      <span className="inline-flex items-center gap-2 text-[var(--text-dim)]">
        <Loader2 className="size-4 animate-spin" />
        {t('testing')}
      </span>
    )
  } else if (saveLine?.kind === 'formatInvalid') {
    row3 = <span className="text-status-danger">{t('formatInvalid')}</span>
  } else if (saveLine?.kind === 'saveFailed') {
    row3 = (
      <span className="text-status-danger">
        {tidy(t('keySaveFailed', { reason: saveLine.reason }))}
      </span>
    )
  } else if (!hasKey) {
    row3 = <span className="text-[var(--text-dim)]">{t('missingBody')}</span>
  } else if (savedJust) {
    row3 = <span className="text-[var(--text-dim)]">{t('keySavedJust')}</span>
  } else if (lastTest?.ok) {
    row3 = (
      <span className="inline-flex items-center gap-2 text-[var(--text-dim)]">
        <Check className={TEST_OK_ICON} aria-hidden />
        {t('lastTestOk', { date: formatTestDate(lastTest.at, locale) })}
      </span>
    )
  } else if (lastTest) {
    row3 = (
      <span className="inline-flex items-start gap-2 text-[var(--text-dim)]">
        <AlertTriangle className="text-status-danger mt-0.5 size-4 shrink-0" aria-hidden />
        <span>
          {tidy(
            t('lastTestFailed', {
              date: formatTestDate(lastTest.at, locale),
              reason: reasonText(lastTest),
            })
          )}
        </span>
      </span>
    )
  } else {
    row3 = <span className="text-[var(--text-mute)]">{t('notTested')}</span>
  }

  const saveButton = editing ? (
    <Button type="submit" disabled={busy || value.trim() === ''} className={KEY_BUTTON}>
      {saving ? (
        <>
          <Loader2 className="size-4 animate-spin" />
          {t('savingKey')}
        </>
      ) : (
        t('saveKey')
      )}
    </Button>
  ) : null

  const testButton = (
    <Button
      type="button"
      variant="outline"
      disabled={!hasKey || editing || busy}
      onClick={onTestKey}
      className={KEY_BUTTON}
    >
      {testing ? (
        <>
          <Loader2 className="size-4 animate-spin" />
          {t('testingButton')}
        </>
      ) : (
        t('testKey')
      )}
    </Button>
  )

  return (
    <section>
      <p className="mb-2 text-[11px] font-semibold tracking-[0.12em] text-[var(--text-mute)] uppercase">
        {t('youtubeKeyTitle')}
      </p>
      <form
        onSubmit={onSaveKey}
        className="flex flex-col gap-3 rounded-card border border-[var(--line)] bg-[var(--bg-2)] px-4 py-3"
      >
        <div className="flex items-center gap-3">
          {!hasKey ? (
            <YouTubeStatusChip tone="bad">{t('keyMissing')}</YouTubeStatusChip>
          ) : testFailed ? (
            <YouTubeStatusChip tone="bad">{t('testFailed')}</YouTubeStatusChip>
          ) : (
            <YouTubeStatusChip tone="ok">{t('keySet')}</YouTubeStatusChip>
          )}
          <p className="min-w-0 flex-1 text-sm text-[var(--text-dim)]">{t('keyHelp')}</p>
        </div>

        <SecretField
          value={value}
          onChange={(v) => {
            setValue(v)
            if (saveLine) setSaveLine(null)
          }}
          saved={editing ? null : { last4: last4 ?? '' }}
          onChangeRequested={() => {
            setChanging(true)
            setSavedJust(false)
            setSaveLine(null)
          }}
          onCancelChange={
            hasKey && changing
              ? () => {
                  setChanging(false)
                  setSaveLine(null)
                }
              : undefined
          }
          label={t('keyLabel')}
          placeholder={t('keyPlaceholder')}
          disabled={testing}
          readOnly={saving}
          actions={
            <>
              {saveButton}
              {testButton}
            </>
          }
        />

        <div aria-live="polite" className="text-sm">
          {row3}
        </div>
      </form>
    </section>
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
            <p className="text-status-warning mt-1.5 flex items-center gap-1 text-xs">
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
