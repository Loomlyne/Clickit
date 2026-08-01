import { getTranslations } from 'next-intl/server'
import { getAppConfig, getYouTubeApiKey } from '@/lib/config'
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
 * The YouTube API key is read only through the server-side helper. The client
 * receives an availability boolean, never the credential.
 */
export default async function AdminSettingsPage() {
  const [config, t, legalPages, faqs, youtubeApiKey] = await Promise.all([
    getAppConfig(),
    getTranslations('admin.settings'),
    getLegalPages(),
    getFaqs(),
    getYouTubeApiKey(),
  ])

  const hasYouTubeKey = Boolean(youtubeApiKey)

  return (
    <div className="space-y-6">
      <AdminPageHeader title={t('heading')} description={t('description')} />

      <SettingsTabs
        config={config}
        hasYouTubeKey={hasYouTubeKey}
        legalPages={legalPages}
        faqs={faqs}
      />
    </div>
  )
}
