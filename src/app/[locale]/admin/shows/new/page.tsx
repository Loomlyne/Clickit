import { createClient } from '@/lib/supabase/server'
import { ShowForm } from '@/components/admin/show-form'
import { AdminBackLink, AdminPageHeader } from '@/components/admin/admin-shell'

export default async function NewShowPage() {
  const supabase = await createClient()
  const { data: categories } = await supabase
    .from('categories')
    .select('*')
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })

  return (
    <div className="space-y-6">
      <AdminBackLink href="/admin">Back to Shows</AdminBackLink>

      <AdminPageHeader
        title="Create Show"
        description="Fill in the details to add a new show to the platform."
      />

      <ShowForm categories={categories ?? []} />
    </div>
  )
}
