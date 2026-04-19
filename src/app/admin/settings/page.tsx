import { getAppConfig } from '@/lib/config'
import { createClient } from '@/lib/supabase/server'
import { SettingsTabs } from '@/components/admin/settings/settings-tabs'

/**
 * Admin settings — site-wide control center.
 *
 * Server component: fetches the full app_config (cached) and hands it to the
 * client tabs component. The cached read is tagged 'site-config' so any
 * server-action save (updateSiteMetadata, updateFooterContent, etc.) refreshes
 * this page via updateTag('site-config') + revalidatePath('/', 'layout').
 *
 * Intentionally does NOT read youtube_api_key (column-level REVOKE on
 * anon/authenticated). The Integrations tab only needs to know whether a key
 * is set; the has-key status is fetched via the admin client below.
 */
export default async function AdminSettingsPage() {
  const config = await getAppConfig()

  // Admin-only: detect whether a YouTube key is already saved. We don't send
  // the key to the client — only a boolean so the masked field can show
  // "••••••••" vs a blank state.
  const supabase = await createClient()
  const { data: adminRow } = await supabase
    .from('app_config')
    .select('youtube_api_key')
    .eq('id', 1)
    .single<{ youtube_api_key: string | null }>()

  const hasYouTubeKey = Boolean(adminRow?.youtube_api_key)

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-[-0.03em] text-white">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Control what visitors see and connect external services — no code required.
        </p>
      </header>

      <SettingsTabs config={config} hasYouTubeKey={hasYouTubeKey} />
    </div>
  )
}
