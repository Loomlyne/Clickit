import { getTranslations } from 'next-intl/server'
import { getAppConfigWithVersion, getYouTubeApiKey } from '@/lib/config'
import { getLegalPages, getFaqs } from '@/app/[locale]/admin/actions'
import { SettingsTabs } from '@/components/admin/settings/settings-tabs'
import { AdminPageHeader } from '@/components/admin/admin-shell'

/**
 * Admin settings — site-wide control center.
 *
 * Server component: reads the full app_config and its updated_at in one
 * uncached read and hands both to the client tabs component. Every form on the
 * page sends that updated_at back with its save (deferred item 23, residual b),
 * so a stale page can never overwrite another admin's save. Server-action saves
 * still refresh the page via updateTag('site-config') + revalidatePath('/', 'layout').
 *
 * The YouTube API key is read only through the server-side helper. The client
 * receives an availability boolean, never the credential.
 */
export default async function AdminSettingsPage() {
  const [{ config, updatedAt }, t, legalPages, faqs, youtubeApiKey] =
    await Promise.all([
      getAppConfigWithVersion(),
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
        updatedAt={updatedAt}
        hasYouTubeKey={hasYouTubeKey}
        legalPages={legalPages}
        faqs={faqs}
      />
    </div>
  )
}
