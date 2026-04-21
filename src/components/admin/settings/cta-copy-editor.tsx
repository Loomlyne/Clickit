'use client'

import { useState } from 'react'
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

const STAGE_LABELS: Record<Stage, string> = {
  zero: 'Pre-launch (empty catalog)',
  growing: 'Growing catalog',
  full: 'Full catalog',
}

const STAGE_HINTS: Record<Stage, string> = {
  zero: 'Shown when zero shows are published — teaser / pre-launch tone.',
  growing: 'Shown once the first few shows ship but the catalog is still small.',
  full: 'Shown when the catalog is robust — lead with what visitors can watch.',
}

export function CtaCopyEditor({ initial }: { initial: CtaCopy }) {
  const [copy, setCopy] = useState<CtaCopy>(initial)
  const [saving, setSaving] = useState(false)

  const dirty = JSON.stringify(copy) !== JSON.stringify(initial)

  async function onSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const result = await updateCtaCopy(copy)
    setSaving(false)
    if (result.success) toast.success('CTA copy saved')
    else toast.error(result.error ?? 'Failed to save')
  }

  function patch(stage: Stage, patch: Partial<CtaStageCopy>) {
    setCopy((c) => ({ ...c, [stage]: { ...c[stage], ...patch } }))
  }

  return (
    <SettingsCard
      title="CTA banner copy"
      description="The full-bleed call-to-action block on the landing page. Edit each catalog-stage variant separately — the site auto-picks based on how many shows are published."
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
                <SettingsField label="Eyebrow label" hint="Tiny uppercase line above the headline.">
                  <Input
                    maxLength={60}
                    value={copy[stage].label}
                    onChange={(e) => patch(stage, { label: e.target.value })}
                  />
                </SettingsField>

                <SettingsField label="Headline (bold)">
                  <Input
                    maxLength={120}
                    value={copy[stage].headline}
                    onChange={(e) => patch(stage, { headline: e.target.value })}
                  />
                </SettingsField>

                <SettingsField
                  label="Headline continuation (dimmed)"
                  hint="Appears in lower-contrast style after the bold part."
                >
                  <Input
                    maxLength={120}
                    value={copy[stage].headlineB}
                    onChange={(e) => patch(stage, { headlineB: e.target.value })}
                  />
                </SettingsField>

                <SettingsField label="Body">
                  <Textarea
                    rows={2}
                    maxLength={300}
                    value={copy[stage].body}
                    onChange={(e) => patch(stage, { body: e.target.value })}
                  />
                </SettingsField>

                <SettingsField label="Primary button text">
                  <Input
                    maxLength={60}
                    value={copy[stage].primaryLabel}
                    onChange={(e) => patch(stage, { primaryLabel: e.target.value })}
                  />
                </SettingsField>

                <SettingsField label="Primary button URL" hint="Path (/browse) or full URL.">
                  <Input
                    value={copy[stage].primaryHref}
                    onChange={(e) => patch(stage, { primaryHref: e.target.value })}
                  />
                </SettingsField>

                <SettingsField label="Secondary link text">
                  <Input
                    maxLength={60}
                    value={copy[stage].secondaryLabel}
                    onChange={(e) => patch(stage, { secondaryLabel: e.target.value })}
                  />
                </SettingsField>

                <SettingsField label="Secondary link URL">
                  <Input
                    value={copy[stage].secondaryHref}
                    onChange={(e) => patch(stage, { secondaryHref: e.target.value })}
                  />
                </SettingsField>
              </div>
            </TabsContent>
          ))}
        </Tabs>

        <div className="flex items-center justify-end">
          <Button type="submit" disabled={!dirty || saving}>
            {saving ? <Loader2 className="size-4 animate-spin" /> : 'Save CTA copy'}
          </Button>
        </div>
      </form>
    </SettingsCard>
  )
}
