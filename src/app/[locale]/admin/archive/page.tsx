import { getTranslations } from 'next-intl/server'
import { createClient } from '@/lib/supabase/server'
import { AlertTriangle } from 'lucide-react'
import { ArchiveTable } from '@/components/admin/archive-table'
import { AdminPanel } from '@/components/admin/admin-shell'

export default async function ArchivePage() {
  const supabase = await createClient()
  const t = await getTranslations('admin.archive')

  const { data: shows } = await supabase
    .from('shows')
    .select('*')
    .eq('archived', true)
    .order('updated_at', { ascending: false })

  return (
    <div className="space-y-6">
      <AdminPanel className="p-6 md:p-8">
        <p className="text-muted-foreground text-xs tracking-[0.24em] uppercase">
          {t('adminConsole')}
        </p>
        <div className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h1 className="text-foreground text-3xl font-semibold tracking-tight">
              {t('heading')}
            </h1>
            <p className="text-muted-foreground mt-2 max-w-2xl text-sm md:text-base">
              {t('description')}
            </p>
          </div>

          <div className="flex max-w-md items-start gap-3 rounded-lg border border-yellow-500/20 bg-yellow-500/8 px-4 py-4">
            <AlertTriangle className="mt-0.5 size-5 shrink-0 text-yellow-400" />
            <div className="text-sm">
              <p className="font-medium text-yellow-100">
                {t('hiddenWarningTitle')}
              </p>
              <p className="mt-1 text-yellow-100/65">{t('warning')}</p>
            </div>
          </div>
        </div>
      </AdminPanel>

      <ArchiveTable shows={shows ?? []} />
    </div>
  )
}
