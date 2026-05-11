import { getTranslations } from 'next-intl/server'
import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { ShowForm } from '@/components/admin/show-form'
import { AdminBackLink, AdminPageHeader } from '@/components/admin/admin-shell'

export default async function EditShowPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const [{ data: show }, { data: categories }, { data: showCategories }, tEdit] =
    await Promise.all([
      supabase.from('shows').select('*').eq('id', id).single(),
      supabase
        .from('categories')
        .select('*')
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true }),
      supabase.from('show_categories').select('category_id').eq('show_id', id),
      getTranslations('admin.editShow'),
    ])

  if (!show) notFound()

  return (
    <div className="space-y-6">
      <AdminBackLink href={`/admin/shows/${id}`}>
        {tEdit('backToShow', { title: show.title })}
      </AdminBackLink>

      <AdminPageHeader
        title={tEdit('title')}
        description={tEdit('description', { title: show.title })}
      />

      <ShowForm
        show={show}
        categories={categories ?? []}
        initialCategoryIds={(showCategories ?? []).map(
          (row) => row.category_id
        )}
      />
    </div>
  )
}
