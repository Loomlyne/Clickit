import { getTranslations } from 'next-intl/server'

import { createClient } from '@/lib/supabase/server'
import { ShowForm } from '@/components/admin/show-form'
import { AdminBackLink, AdminPageHeader } from '@/components/admin/admin-shell'

export default async function NewShowPage() {
  const supabase = await createClient()
  const [{ data: categories }, tDash, tNew] = await Promise.all([
    supabase
      .from('categories')
      .select('*')
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true }),
    getTranslations('admin.dashboard'),
    getTranslations('admin.newShow'),
  ])

  return (
    <div className="space-y-6">
      <AdminBackLink href="/admin">{tNew('backToShows')}</AdminBackLink>

      <AdminPageHeader
        title={tDash('createShow')}
        description={tNew('description')}
      />

      <ShowForm categories={categories ?? []} />
    </div>
  )
}
