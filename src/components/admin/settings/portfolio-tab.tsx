'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { updatePortfolioContent } from '@/app/[locale]/admin/actions'
import type { AppConfig } from '@/lib/config'
import { SettingsCard, SettingsField } from './settings-card'
import { FooterEditor } from './footer-editor'

function PageHeading({
  title,
  description,
}: {
  title: string
  description: string
}) {
  return (
    <div className="border-b border-[var(--line)] pb-2">
      <h2 className="text-foreground/70 text-sm font-semibold tracking-wide uppercase">
        {title}
      </h2>
      <p className="text-muted-foreground mt-0.5 text-xs">{description}</p>
    </div>
  )
}

type Values = {
  hero_description: string
  hero_description_ar: string
  portfolio_heading: string
  portfolio_heading_ar: string
}

export function PortfolioTab({ config }: { config: AppConfig }) {
  const t = useTranslations('admin.settings')
  const [values, setValues] = useState<Values>({
    hero_description: config.heroDescription ?? '',
    hero_description_ar: config.heroDescriptionAr ?? '',
    portfolio_heading: config.portfolioHeading ?? '',
    portfolio_heading_ar: config.portfolioHeadingAr ?? '',
  })
  const [saving, setSaving] = useState(false)

  const initial: Values = {
    hero_description: config.heroDescription ?? '',
    hero_description_ar: config.heroDescriptionAr ?? '',
    portfolio_heading: config.portfolioHeading ?? '',
    portfolio_heading_ar: config.portfolioHeadingAr ?? '',
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
    })
    setSaving(false)
    if (result.success) toast.success(t('portfolioSaved'))
    else toast.error(result.error ?? t('saveFailed'))
  }

  return (
    <div className="space-y-10">
      <form onSubmit={onSave} className="space-y-10">
        {/* ── Landing Page ───────────────────────────────────────────── */}
        <section className="space-y-6">
          <PageHeading
            title={t('portfolioLandingTitle')}
            description={t('portfolioLandingDesc')}
          />

          {/* Hero section */}
          <SettingsCard
            title={t('portfolioHeroTitle')}
            description={t('portfolioHeroDesc')}
          >
            <div className="grid gap-4 md:grid-cols-2">
              <div className="md:col-span-2">
                <SettingsField
                  label={t('heroDescriptionLabel')}
                  hint={t('heroDescriptionHint')}
                >
                  <Textarea
                    value={values.hero_description}
                    onChange={(e) => set({ hero_description: e.target.value })}
                    placeholder={t('heroDescriptionPlaceholder')}
                    maxLength={500}
                    rows={3}
                    className="rounded-lg"
                  />
                </SettingsField>
              </div>
              <div className="md:col-span-2">
                <SettingsField
                  label={t('heroDescriptionArLabel')}
                  hint={t('heroDescriptionArHint')}
                >
                  <Textarea
                    dir="rtl"
                    value={values.hero_description_ar}
                    onChange={(e) =>
                      set({ hero_description_ar: e.target.value })
                    }
                    placeholder={t('heroDescriptionArPlaceholder')}
                    maxLength={500}
                    rows={3}
                    className="rounded-lg"
                  />
                </SettingsField>
              </div>
            </div>
          </SettingsCard>

          {/* Shows section heading */}
          <SettingsCard
            title={t('portfolioShowsTitle')}
            description={t('portfolioShowsDesc')}
          >
            <div className="grid gap-4 md:grid-cols-2">
              <SettingsField
                label={t('portfolioShowsHeadingLabel')}
                hint={t('portfolioShowsHeadingHint')}
              >
                <Input
                  value={values.portfolio_heading}
                  onChange={(e) => set({ portfolio_heading: e.target.value })}
                  placeholder={t('portfolioShowsHeadingPlaceholder')}
                  maxLength={200}
                />
              </SettingsField>
              <SettingsField
                label={t('portfolioShowsHeadingArLabel')}
                hint={t('portfolioShowsHeadingArHint')}
              >
                <Input
                  dir="rtl"
                  value={values.portfolio_heading_ar}
                  onChange={(e) =>
                    set({ portfolio_heading_ar: e.target.value })
                  }
                  placeholder={t('portfolioShowsHeadingArPlaceholder')}
                  maxLength={200}
                />
              </SettingsField>
            </div>
          </SettingsCard>
        </section>

        <div className="flex justify-end">
          <Button type="submit" disabled={!dirty || saving}>
            {saving ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              t('portfolioSave')
            )}
          </Button>
        </div>
      </form>

      {/* ── Footer (all pages) ─────────────────────────────────────── */}
      <section className="space-y-6">
        <PageHeading
          title={t('portfolioFooterTitle')}
          description={t('portfolioFooterDesc')}
        />
        <FooterEditor initial={config.footer} />
      </section>
    </div>
  )
}
