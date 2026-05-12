'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from '@/components/ui/tabs'
import { updateCtaCopy } from '@/app/[locale]/admin/actions'
import type { CtaCopy, CtaStageCopy } from '@/lib/config'
import { SettingsCard, SettingsField } from './settings-card'

type Stage = keyof CtaCopy // 'zero' | 'growing' | 'full'

function getStageLabels(t: ReturnType<typeof useTranslations>): Record<Stage, string> {
  return {
    zero: t('stageZero'),
    growing: t('stageGrowing'),
    full: t('stageFull'),
  }
}

function getStageHints(t: ReturnType<typeof useTranslations>): Record<Stage, string> {
  return {
    zero: t('stageZeroHint'),
    growing: t('stageGrowingHint'),
    full: t('stageFullHint'),
  }
}

export function CtaCopyEditor({ initial }: { initial: CtaCopy }) {
  const [copy, setCopy] = useState<CtaCopy>(initial)
  const [saving, setSaving] = useState(false)
  const t = useTranslations('admin.settings')
  const STAGE_LABELS = getStageLabels(t)
  const STAGE_HINTS = getStageHints(t)

  const dirty = JSON.stringify(copy) !== JSON.stringify(initial)

  async function onSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const result = await updateCtaCopy(copy)
    setSaving(false)
    if (result.success) toast.success(t('ctaCopySaved'))
    else toast.error(result.error ?? t('saveFailed'))
  }

  function patch(stage: Stage, patch: Partial<CtaStageCopy>) {
    setCopy((c) => ({ ...c, [stage]: { ...c[stage], ...patch } }))
  }

  return (
    <SettingsCard
      title={t('ctaCopyTitle')}
      description={t('ctaCopyDescription')}
    >
      <form onSubmit={onSave} className="space-y-6">
        <Tabs defaultValue="growing" className="gap-4">
          <TabsList>
            {(Object.keys(STAGE_LABELS) as Stage[]).map((stage) => (
              <TabsTrigger key={stage} value={stage}>
                {STAGE_LABELS[stage]}
              </TabsTrigger>
            ))}
          </TabsList>

          {(Object.keys(STAGE_LABELS) as Stage[]).map((stage) => (
            <TabsContent key={stage} value={stage} className="space-y-4">
              <p className="text-xs text-muted-foreground">{STAGE_HINTS[stage]}</p>

              <div className="grid gap-4 md:grid-cols-2">
                <SettingsField label={t('eyebrowLabel')} hint={t('eyebrowHint')}>
                  <Input
                    maxLength={60}
                    value={copy[stage].label}
                    onChange={(e) => patch(stage, { label: e.target.value })}
                    className="rounded-[12px]"
                  />
                </SettingsField>

                <SettingsField label={t('headlineLabel')}>
                  <Input
                    maxLength={120}
                    value={copy[stage].headline}
                    onChange={(e) => patch(stage, { headline: e.target.value })}
                    className="rounded-[12px]"
                  />
                </SettingsField>

                <SettingsField
                  label={t('headlineContinuationLabel')}
                  hint={t('headlineContinuationHint')}
                >
                  <Input
                    maxLength={120}
                    value={copy[stage].headlineB}
                    onChange={(e) => patch(stage, { headlineB: e.target.value })}
                    className="rounded-[12px]"
                  />
                </SettingsField>

                <SettingsField label={t('bodyLabel')}>
                  <Textarea
                    rows={2}
                    maxLength={300}
                    value={copy[stage].body}
                    onChange={(e) => patch(stage, { body: e.target.value })}
                    className="rounded-[12px]"
                  />
                </SettingsField>

                <SettingsField label={t('primaryButtonTextLabel')}>
                  <Input
                    maxLength={60}
                    value={copy[stage].primaryLabel}
                    onChange={(e) => patch(stage, { primaryLabel: e.target.value })}
                    className="rounded-[12px]"
                  />
                </SettingsField>

                <SettingsField label={t('primaryButtonUrlLabel')} hint={t('buttonUrlHint')}>
                  <Input
                    value={copy[stage].primaryHref}
                    onChange={(e) => patch(stage, { primaryHref: e.target.value })}
                    className="rounded-[12px]"
                  />
                </SettingsField>

                <SettingsField label={t('secondaryLinkTextLabel')}>
                  <Input
                    maxLength={60}
                    value={copy[stage].secondaryLabel}
                    onChange={(e) => patch(stage, { secondaryLabel: e.target.value })}
                    className="rounded-[12px]"
                  />
                </SettingsField>

                <SettingsField label={t('secondaryLinkUrlLabel')}>
                  <Input
                    value={copy[stage].secondaryHref}
                    onChange={(e) => patch(stage, { secondaryHref: e.target.value })}
                    className="rounded-[12px]"
                  />
                </SettingsField>
              </div>
            </TabsContent>
          ))}
        </Tabs>

        <div className="flex items-center justify-end">
          <Button type="submit" disabled={!dirty || saving}>
            {saving ? <Loader2 className="size-4 animate-spin" /> : t('saveCtaCopy')}
          </Button>
        </div>
      </form>
    </SettingsCard>
  )
}
