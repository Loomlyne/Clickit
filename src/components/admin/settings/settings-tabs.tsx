'use client'

import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import type { AppConfig } from '@/lib/config'
import { GeneralTab } from './general-tab'
import { BrandingTab } from './branding-tab'
import { IntegrationsTab } from './integrations-tab'
import { AdvancedTab } from './advanced-tab'

export function SettingsTabs({
  config,
  hasYouTubeKey,
}: {
  config: AppConfig
  hasYouTubeKey: boolean
}) {
  return (
    <Tabs defaultValue="general" className="gap-6">
      <TabsList className="w-full md:w-fit">
        <TabsTrigger value="general">General</TabsTrigger>
        <TabsTrigger value="branding">Branding</TabsTrigger>
        <TabsTrigger value="integrations">Integrations</TabsTrigger>
        <TabsTrigger value="advanced">Advanced</TabsTrigger>
      </TabsList>

      <TabsContent value="general" className="space-y-6">
        <GeneralTab config={config} />
      </TabsContent>

      <TabsContent value="branding" className="space-y-6">
        <BrandingTab config={config} />
      </TabsContent>

      <TabsContent value="integrations" className="space-y-6">
        <IntegrationsTab config={config} hasYouTubeKey={hasYouTubeKey} />
      </TabsContent>

      <TabsContent value="advanced" className="space-y-6">
        <AdvancedTab config={config} />
      </TabsContent>
    </Tabs>
  )
}
