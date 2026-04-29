import { CategoriesManager } from '@/components/admin/categories-manager'
import { createClient } from '@/lib/supabase/server'

export default async function CategoriesPage() {
  const supabase = await createClient()
  const [{ data: categories }, { data: assignments }] = await Promise.all([
    supabase
      .from('categories')
      .select('*')
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true }),
    supabase
      .from('show_categories')
      .select('category_id'),
  ])

  const assignmentCounts = (assignments ?? []).reduce<Record<string, number>>((acc, row) => {
    acc[row.category_id] = (acc[row.category_id] ?? 0) + 1
    return acc
  }, {})

  const categoriesWithCounts = (categories ?? []).map((category) => ({
    ...category,
    showCount: assignmentCounts[category.id] ?? 0,
  }))

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Browse</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-foreground">Categories</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Curate the browse rails, control their order, and assign shows from the show editor.
        </p>
      </div>

      <CategoriesManager initialCategories={categoriesWithCounts} />
    </div>
  )
}
