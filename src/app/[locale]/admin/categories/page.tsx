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
    supabase.from('show_categories').select('category_id'),
  ])

  const assignmentCounts = (assignments ?? []).reduce<Record<string, number>>(
    (acc, row) => {
      acc[row.category_id] = (acc[row.category_id] ?? 0) + 1
      return acc
    },
    {}
  )

  const categoriesWithCounts = (categories ?? []).map((category) => ({
    ...category,
    showCount: assignmentCounts[category.id] ?? 0,
  }))

  return (
    <div className="space-y-6">
      <CategoriesManager initialCategories={categoriesWithCounts} />
    </div>
  )
}
