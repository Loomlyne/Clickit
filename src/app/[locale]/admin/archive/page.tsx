import { getLocale, getTranslations } from 'next-intl/server'
import { createClient } from '@/lib/supabase/server'
import { AlertTriangle } from 'lucide-react'
import { ArchiveTable } from '@/components/admin/archive-table'

export default async function ArchivePage() {
  const supabase = await createClient()
  const [t, locale] = await Promise.all([
    getTranslations('admin.archive'),
    getLocale(),
  ])
  const isArabic = locale === 'ar'

  const { data: shows } = await supabase
    .from('shows')
    .select('*')
    .eq('archived', true)
    .order('updated_at', { ascending: false })

  return (
    <div className="space-y-6">
      <div className="rounded-[6px] border border-[var(--line)] bg-[var(--bg-2)] p-6 md:p-8">
        <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">
          {isArabic ? 'لوحة الإدارة' : 'Admin Console'}
        </p>
        <div className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-foreground">
              {t('heading')}
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground md:text-base">
              {t('description')}
            </p>
          </div>

          <div className="flex max-w-md items-start gap-3 rounded-[6px] border border-yellow-500/20 bg-yellow-500/8 px-4 py-4">
            <AlertTriangle className="mt-0.5 size-5 shrink-0 text-yellow-400" />
            <div className="text-sm">
              <p className="font-medium text-yellow-100">
                {isArabic ? 'البرامج المؤرشفة مخفية عن الزوار' : 'Archived shows are hidden from viewers'}
              </p>
              <p className="mt-1 text-yellow-100/65">
                {t('warning')}
              </p>
            </div>
          </div>
        </div>
      </div>

      <ArchiveTable shows={shows ?? []} />
    </div>
  )
}
