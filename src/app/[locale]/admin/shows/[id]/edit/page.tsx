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

  const [{ data: show }, { data: categories }, { data: showCategories }] =
    await Promise.all([
      supabase.from('shows').select('*').eq('id', id).single(),
      supabase
        .from('categories')
        .select('*')
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true }),
      supabase.from('show_categories').select('category_id').eq('show_id', id),
    ])

  if (!show) notFound()

  return (
    <div className="space-y-6">
      <AdminBackLink href={`/admin/shows/${id}`}>
        Back to {show.title}
      </AdminBackLink>

      <AdminPageHeader
        title="Edit Show"
        description={`Editing "${show.title}"`}
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
