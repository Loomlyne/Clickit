'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import {
  Loader2,
  LayoutGrid,
  Megaphone,
  HelpCircle,
  Moon,
  RefreshCw,
  AlertTriangle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  updateFeatureFlags,
  revalidateAllCache,
} from '@/app/[locale]/admin/actions'
import type { AppConfig, FeatureFlags } from '@/lib/config'
import { SettingsCard } from './settings-card'

type FlagMeta = {
  key: keyof FeatureFlags
  title: string
  description: string
  icon: React.ReactNode
  warning?: string
}

const FLAGS: FlagMeta[] = [
  {
    key: 'showGenresGrid',
    title: 'Show "Browse by Genre" section',
    description: 'The horizontal genre rail on the landing page.',
    icon: <LayoutGrid className="size-4" />,
  },
  {
    key: 'showCtaBanner',
    title: 'Show CTA banner',
    description: 'The full-bleed call-to-action block. Copy editable in General tab.',
    icon: <Megaphone className="size-4" />,
  },
  {
    key: 'showFaq',
    title: 'Show FAQ section',
    description: 'The expandable FAQ block near the bottom of the landing page.',
    icon: <HelpCircle className="size-4" />,
  },
  {
    key: 'comingSoonMode',
    title: 'Coming-soon mode',
    description:
      'Gate the whole site behind a splash page. Only /admin and /auth stay accessible. Non-admin visitors are redirected to /coming-soon.',
    icon: <Moon className="size-4" />,
    warning: 'Hides the entire public catalog. Only turn on before launch or during maintenance.',
  },
]

export function AdvancedTab({ config }: { config: AppConfig }) {
  const [flags, setFlags] = useState<FeatureFlags>(config.flags)
  const [saving, setSaving] = useState(false)
  const [revalidating, setRevalidating] = useState(false)

  const dirty = JSON.stringify(flags) !== JSON.stringify(config.flags)

  async function onSave() {
    setSaving(true)
    const result = await updateFeatureFlags(flags)
    setSaving(false)
    if (result.success) toast.success('Feature flags saved')
    else toast.error(result.error ?? 'Failed to save')
  }

  async function onRevalidate() {
    setRevalidating(true)
    const result = await revalidateAllCache()
    setRevalidating(false)
    if (result.success) toast.success('Cache refreshed — reload the site to verify')
    else toast.error(result.error ?? 'Failed to revalidate')
  }

  return (
    <>
      <SettingsCard
        title="Feature flags"
        description="Show or hide landing-page sections without shipping code."
        action={
          <Button size="sm" onClick={onSave} disabled={!dirty || saving}>
            {saving ? <Loader2 className="size-4 animate-spin" /> : 'Save flags'}
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

      <SettingsCard
        title="Cache"
        description="Force the public pages to re-fetch shows, episodes, and site config. Use this after bulk DB edits or if something looks stale."
      >
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
          Revalidate all caches
        </Button>
      </SettingsCard>

      <SettingsCard
        title="Admin account"
        description="Single-admin v1 — the user ID below is the only account allowed to edit. Contact the developer to transfer ownership."
      >
        <div className="rounded-[12px] border border-white/10 bg-black/20 px-4 py-3 font-mono text-xs text-muted-foreground">
          {/* We don't read admin_user_id here to avoid an extra DB hop; surfacing the
              current session email instead would require a server prop. Left as a
              future enhancement. */}
          Currently signed-in admin manages this site.
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
    <label className="flex cursor-pointer items-start justify-between gap-4 rounded-[12px] border border-white/8 bg-black/20 px-4 py-3 transition-colors hover:border-white/16">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex size-8 items-center justify-center rounded-full bg-white/[0.06] text-white/70">
          {meta.icon}
        </span>
        <div className="min-w-0">
          <p className="text-sm font-medium text-white">{meta.title}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{meta.description}</p>
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
