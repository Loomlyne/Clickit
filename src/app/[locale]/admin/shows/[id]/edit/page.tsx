import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { Link } from '@/i18n/navigation'
import { ArrowLeft } from 'lucide-react'
import { ShowForm } from '@/components/admin/show-form'

export default async function EditShowPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const [{ data: show }, { data: categories }, { data: showCategories }] = await Promise.all([
    supabase
      .from('shows')
      .select('*')
      .eq('id', id)
      .single(),
    supabase
      .from('categories')
      .select('*')
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true }),
    supabase
      .from('show_categories')
      .select('category_id')
      .eq('show_id', id),
  ])

  if (!show) notFound()

  return (
    <div className="space-y-6">
      <Link
        href={`/admin/shows/${id}`}
        className="inline-flex items-center gap-1.5 rounded-[4px] border border-[var(--line)] bg-[var(--bg-2)] px-4 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4 rtl:scale-x-[-1]" />
        Back to {show.title}
      </Link>

      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Edit Show</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Editing &ldquo;{show.title}&rdquo;
        </p>
      </div>

      <ShowForm
        show={show}
        categories={categories ?? []}
        initialCategoryIds={(showCategories ?? []).map((row) => row.category_id)}
      />
    </div>
  )
}
