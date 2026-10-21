import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'

import { AdminPageHeader } from '@/components/admin/admin-shell'
import { DesignSystemView } from '@/components/admin/design-system/design-system-view'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('admin.designSystem')
  return { title: `${t('pageTitle')} | Clickit Admin` }
}

// Read-only page. It holds no data: access is decided by the admin layout
// (signed-out and non-admin visitors are redirected before this renders).
export default async function DesignSystemPage() {
  const t = await getTranslations('admin.designSystem')

  return (
    <div className="space-y-8">
      <AdminPageHeader
        crumb={
          <p className="text-[11px] tracking-[0.14em] text-[var(--text-mute)] uppercase">
            {t('eyebrow')}
          </p>
        }
        title={t('pageTitle')}
        description={t('pageDescription')}
      />
      <DesignSystemView />
    </div>
  )
}
