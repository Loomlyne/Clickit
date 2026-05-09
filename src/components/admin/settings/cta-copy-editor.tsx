'use client'

import { useState } from 'react'
import { useLocale } from 'next-intl'
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

function getStageLabels(isArabic: boolean): Record<Stage, string> {
  return {
    zero: isArabic ? 'قبل الإطلاق (مكتبة فارغة)' : 'Pre-launch (empty catalog)',
    growing: isArabic ? 'مكتبة متنامية' : 'Growing catalog',
    full: isArabic ? 'مكتبة ممتلئة' : 'Full catalog',
  }
}

function getStageHints(isArabic: boolean): Record<Stage, string> {
  return {
    zero: isArabic ? 'يُعرض عند عدم نشر أي برنامج — نبرة تشويق / ما قبل الإطلاق.' : 'Shown when zero shows are published — teaser / pre-launch tone.',
    growing: isArabic ? 'يُعرض بعد إطلاق أول برامج قليلة مع بقاء المكتبة صغيرة.' : 'Shown once the first few shows ship but the catalog is still small.',
    full: isArabic ? 'يُعرض عندما تصبح المكتبة غنية — ابدأ بما يمكن للزوار مشاهدته.' : 'Shown when the catalog is robust — lead with what visitors can watch.',
  }
}

export function CtaCopyEditor({ initial }: { initial: CtaCopy }) {
  const [copy, setCopy] = useState<CtaCopy>(initial)
  const [saving, setSaving] = useState(false)
  const locale = useLocale()
  const isArabic = locale === 'ar'
  const STAGE_LABELS = getStageLabels(isArabic)
  const STAGE_HINTS = getStageHints(isArabic)

  const dirty = JSON.stringify(copy) !== JSON.stringify(initial)

  async function onSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const result = await updateCtaCopy(copy)
    setSaving(false)
    if (result.success) toast.success(isArabic ? 'تم حفظ نص الدعوة للإجراء' : 'CTA copy saved')
    else toast.error(result.error ?? (isArabic ? 'تعذّر الحفظ' : 'Failed to save'))
  }

  function patch(stage: Stage, patch: Partial<CtaStageCopy>) {
    setCopy((c) => ({ ...c, [stage]: { ...c[stage], ...patch } }))
  }

  return (
    <SettingsCard
      title={isArabic ? 'نص لافتة الدعوة للإجراء' : 'CTA banner copy'}
      description={isArabic
        ? 'كتلة الدعوة للإجراء كاملة العرض في الصفحة الرئيسية. عدّل كل متغيّر حسب مرحلة المكتبة بشكل منفصل — الموقع يختار تلقائياً حسب عدد البرامج المنشورة.'
        : 'The full-bleed call-to-action block on the landing page. Edit each catalog-stage variant separately — the site auto-picks based on how many shows are published.'}
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
                <SettingsField label={isArabic ? 'نص الحاجب' : 'Eyebrow label'} hint={isArabic ? 'سطر صغير أحرف كبيرة فوق العنوان.' : 'Tiny uppercase line above the headline.'}>
                  <Input
                    maxLength={60}
                    value={copy[stage].label}
                    onChange={(e) => patch(stage, { label: e.target.value })}
                    className="rounded-[12px]"
                  />
                </SettingsField>

                <SettingsField label={isArabic ? 'العنوان (غامق)' : 'Headline (bold)'}>
                  <Input
                    maxLength={120}
                    value={copy[stage].headline}
                    onChange={(e) => patch(stage, { headline: e.target.value })}
                    className="rounded-[12px]"
                  />
                </SettingsField>

                <SettingsField
                  label={isArabic ? 'استكمال العنوان (خافت)' : 'Headline continuation (dimmed)'}
                  hint={isArabic ? 'يظهر بأسلوب تباين أقل بعد الجزء الغامق.' : 'Appears in lower-contrast style after the bold part.'}
                >
                  <Input
                    maxLength={120}
                    value={copy[stage].headlineB}
                    onChange={(e) => patch(stage, { headlineB: e.target.value })}
                    className="rounded-[12px]"
                  />
                </SettingsField>

                <SettingsField label={isArabic ? 'النص' : 'Body'}>
                  <Textarea
                    rows={2}
                    maxLength={300}
                    value={copy[stage].body}
                    onChange={(e) => patch(stage, { body: e.target.value })}
                    className="rounded-[12px]"
                  />
                </SettingsField>

                <SettingsField label={isArabic ? 'نص الزر الأساسي' : 'Primary button text'}>
                  <Input
                    maxLength={60}
                    value={copy[stage].primaryLabel}
                    onChange={(e) => patch(stage, { primaryLabel: e.target.value })}
                    className="rounded-[12px]"
                  />
                </SettingsField>

                <SettingsField label={isArabic ? 'رابط الزر الأساسي' : 'Primary button URL'} hint={isArabic ? 'مسار (/watch) أو رابط كامل.' : 'Path (/watch) or full URL.'}>
                  <Input
                    value={copy[stage].primaryHref}
                    onChange={(e) => patch(stage, { primaryHref: e.target.value })}
                    className="rounded-[12px]"
                  />
                </SettingsField>

                <SettingsField label={isArabic ? 'نص الرابط الثانوي' : 'Secondary link text'}>
                  <Input
                    maxLength={60}
                    value={copy[stage].secondaryLabel}
                    onChange={(e) => patch(stage, { secondaryLabel: e.target.value })}
                    className="rounded-[12px]"
                  />
                </SettingsField>

                <SettingsField label={isArabic ? 'رابط الرابط الثانوي' : 'Secondary link URL'}>
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
            {saving ? <Loader2 className="size-4 animate-spin" /> : (isArabic ? 'حفظ نص الدعوة' : 'Save CTA copy')}
          </Button>
        </div>
      </form>
    </SettingsCard>
  )
}
