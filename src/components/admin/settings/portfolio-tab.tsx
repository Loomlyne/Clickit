'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { updatePortfolioContent } from '@/app/[locale]/admin/actions'
import type { AppConfig } from '@/lib/config'
import { SettingsCard, SettingsField } from './settings-card'

function PageHeading({
  title,
  description,
}: {
  title: string
  description: string
}) {
  return (
    <div className="border-b border-[var(--line)] pb-2">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-foreground/70">
        {title}
      </h2>
      <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
    </div>
  )
}

type Values = {
  hero_description: string
  hero_description_ar: string
  portfolio_heading: string
  portfolio_heading_ar: string
  footer_tagline: string
}

export function PortfolioTab({ config }: { config: AppConfig }) {
  const [values, setValues] = useState<Values>({
    hero_description: config.heroDescription ?? '',
    hero_description_ar: config.heroDescriptionAr ?? '',
    portfolio_heading: config.portfolioHeading ?? '',
    portfolio_heading_ar: config.portfolioHeadingAr ?? '',
    footer_tagline: config.footer.tagline,
  })
  const [saving, setSaving] = useState(false)

  const initial: Values = {
    hero_description: config.heroDescription ?? '',
    hero_description_ar: config.heroDescriptionAr ?? '',
    portfolio_heading: config.portfolioHeading ?? '',
    portfolio_heading_ar: config.portfolioHeadingAr ?? '',
    footer_tagline: config.footer.tagline,
  }

  const dirty = JSON.stringify(values) !== JSON.stringify(initial)

  function set(patch: Partial<Values>) {
    setValues((v) => ({ ...v, ...patch }))
  }

  async function onSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const result = await updatePortfolioContent({
      hero_description: values.hero_description || null,
      hero_description_ar: values.hero_description_ar || null,
      portfolio_heading: values.portfolio_heading || null,
      portfolio_heading_ar: values.portfolio_heading_ar || null,
      footer_tagline: values.footer_tagline,
    })
    setSaving(false)
    if (result.success) toast.success('Portfolio content saved')
    else toast.error(result.error ?? 'Failed to save')
  }

  return (
    <form onSubmit={onSave} className="space-y-10">
      {/* ── Landing Page ───────────────────────────────────────────── */}
      <section className="space-y-6">
        <PageHeading
          title="Landing Page"
          description="Content shown on the public landing page."
        />

        {/* Hero section */}
        <SettingsCard
          title="Hero Section"
          description="Text shown on the landing page hero below the logo."
        >
          <div className="grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <SettingsField
                label="Hero Description"
                hint="Paragraph shown below the logo on the landing page hero. Leave blank to use the default copy."
              >
                <Textarea
                  value={values.hero_description}
                  onChange={(e) => set({ hero_description: e.target.value })}
                  placeholder="A global digital media platform from the UAE…"
                  maxLength={500}
                  rows={3}
                  className="rounded-[12px]"
                />
              </SettingsField>
            </div>
            <div className="md:col-span-2">
              <SettingsField
                label="Hero Description (Arabic)"
                hint="Arabic paragraph shown on the hero when the viewer switches to Arabic. Leave blank to use the default Arabic copy."
              >
                <Textarea
                  dir="rtl"
                  value={values.hero_description_ar}
                  onChange={(e) => set({ hero_description_ar: e.target.value })}
                  placeholder="منصة إعلامية رقمية عالمية من الإمارات…"
                  maxLength={500}
                  rows={3}
                  className="rounded-[12px]"
                />
              </SettingsField>
            </div>
          </div>
        </SettingsCard>

        {/* Shows section heading */}
        <SettingsCard
          title="Shows Section"
          description="Heading above the shows grid on the landing page."
        >
          <div className="grid gap-4 md:grid-cols-2">
            <SettingsField
              label="Shows Heading"
              hint="Large heading above the shows grid. Leave blank to use the default."
            >
              <Input
                value={values.portfolio_heading}
                onChange={(e) => set({ portfolio_heading: e.target.value })}
                placeholder="Click the Moment, Live the Story"
                maxLength={200}
              />
            </SettingsField>
            <SettingsField
              label="Shows Heading (Arabic)"
              hint="Arabic heading shown when the viewer is on the Arabic locale."
            >
              <Input
                dir="rtl"
                value={values.portfolio_heading_ar}
                onChange={(e) => set({ portfolio_heading_ar: e.target.value })}
                placeholder="انقر اللحظة، عش القصة"
                maxLength={200}
              />
            </SettingsField>
          </div>
        </SettingsCard>
      </section>

      {/* ── Footer (all pages) ─────────────────────────────────────── */}
      <section className="space-y-6">
        <PageHeading
          title="Footer"
          description="Shown in the footer across every page."
        />

        {/* Footer tagline */}
        <SettingsCard
          title="Footer Tagline"
          description="Short italicised sentence shown in the footer below the logo."
        >
          <SettingsField
            label="Tagline"
            hint="Appears in the footer. Keep it under 150 characters."
          >
            <Textarea
              value={values.footer_tagline}
              onChange={(e) => set({ footer_tagline: e.target.value })}
              placeholder="From the UAE to the world…"
              maxLength={300}
              rows={2}
              className="rounded-[12px]"
            />
          </SettingsField>
        </SettingsCard>
      </section>

      <div className="flex justify-end">
        <Button type="submit" disabled={!dirty || saving}>
          {saving ? <Loader2 className="size-4 animate-spin" /> : 'Save portfolio content'}
        </Button>
      </div>
    </form>
  )
}
