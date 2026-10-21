'use client'

import { useTranslations } from 'next-intl'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import type { AppConfig } from '@/lib/config'
import type { LegalPage, Faq } from '@/app/[locale]/admin/actions'
import { GeneralTab } from './general-tab'
import { BrandingTab } from './branding-tab'
import { AdvancedTab, type YouTubeKeyView } from './advanced-tab'
import { LegalTab } from './legal-tab'
import { PortfolioTab } from './portfolio-tab'
import { AuthTab } from './auth-tab'
import { RowVersionProvider } from '@/components/admin/row-version'

export function SettingsTabs({
  config,
  updatedAt,
  youtubeKey,
  legalPages,
  faqs,
}: {
  config: AppConfig
  /** app_config.updated_at from the same read as `config`; every form here sends it back. */
  updatedAt: string
  youtubeKey: YouTubeKeyView
  legalPages: LegalPage[]
  faqs: Faq[]
}) {
  const t = useTranslations('admin.settings')
  return (
    <RowVersionProvider updatedAt={updatedAt}>
      <Tabs defaultValue="general" className="gap-6">
        {/* Scrollable pill bar — on narrow viewports the tabs overflow and scroll
          horizontally rather than squishing or wrapping. */}
        <div className="overflow-x-auto">
          <TabsList className="min-w-max">
            <TabsTrigger value="general">{t('generalTab')}</TabsTrigger>
            <TabsTrigger value="branding">{t('brandingTab')}</TabsTrigger>
            <TabsTrigger value="advanced">{t('advancedTab')}</TabsTrigger>
            <TabsTrigger value="auth">{t('authTab')}</TabsTrigger>
            <TabsTrigger value="legal">Legal</TabsTrigger>
            <TabsTrigger value="portfolio">Information</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="general" className="space-y-6">
          <GeneralTab config={config} />
        </TabsContent>

        <TabsContent value="branding" className="space-y-6">
          <BrandingTab config={config} />
        </TabsContent>

        <TabsContent value="advanced" className="space-y-6">
          <AdvancedTab config={config} youtubeKey={youtubeKey} />
        </TabsContent>

        <TabsContent value="auth" className="space-y-6">
          <AuthTab config={config} />
        </TabsContent>

        <TabsContent value="legal" className="space-y-6">
          <LegalTab legalPages={legalPages} faqs={faqs} />
        </TabsContent>

        <TabsContent value="portfolio" className="space-y-6">
          <PortfolioTab config={config} />
        </TabsContent>
      </Tabs>
    </RowVersionProvider>
  )
}
