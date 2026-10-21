import { getTranslations } from 'next-intl/server'
import { getAppConfig } from '@/lib/config'
import { createAdminClient } from '@/lib/supabase/admin'
import { readLastKeyTestCore } from '@/lib/admin/youtube-key-status'
import { readYouTubeKeyMeta } from '@/server/youtube-key'
import { getLegalPages, getFaqs } from '@/app/[locale]/admin/actions'
import { SettingsTabs } from '@/components/admin/settings/settings-tabs'
import { AdminPageHeader } from '@/components/admin/admin-shell'

/**
 * Admin settings — site-wide control center.
 *
 * Server component: fetches the full app_config (cached) and hands it to the
 * client tabs component. The cached read is tagged 'site-config' so any
 * server-action save (updateSiteMetadata, updateFooterContent, etc.) refreshes
 * this page via updateTag('site-config') + revalidatePath('/', 'layout').
 *
 * YouTube key (G6): the page reads only whether a key is stored, its last 4
 * characters and the last Test key result. The key itself never leaves the
 * server; it is saved through the saveYouTubeApiKey Server Action.
 */
export default async function AdminSettingsPage() {
  const [config, t, legalPages, faqs, keyMeta, lastTest] = await Promise.all([
    getAppConfig(),
    getTranslations('admin.settings'),
    getLegalPages(),
    getFaqs(),
    readYouTubeKeyMeta(),
    readLastKeyTestCore(createAdminClient()),
  ])

  // Only these three fields cross to the client.
  const youtubeKey = { hasKey: keyMeta.hasKey, last4: keyMeta.last4, lastTest }

  return (
    <div className="space-y-6">
      <AdminPageHeader title={t('heading')} description={t('description')} />

      <SettingsTabs
        config={config}
        youtubeKey={youtubeKey}
        legalPages={legalPages}
        faqs={faqs}
      />
    </div>
  )
}
