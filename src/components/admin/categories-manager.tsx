'use client'

import { useMemo, useState } from 'react'
import { ArrowDown, ArrowUp, Pencil, Trash2, X } from 'lucide-react'
import { toast } from 'sonner'

import { createCategory, deleteCategory, reorderCategories, updateCategory } from '@/app/[locale]/admin/actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { generateSlug } from '@/lib/slug'
import type { Database } from '@/lib/database.types'

type CategoryRecord = Database['public']['Tables']['categories']['Row'] & {
  showCount: number
}

type CategoryDraft = {
  name_en: string
  name_ar: string
  slug: string
  icon: string
}

const EMPTY_DRAFT: CategoryDraft = {
  name_en: '',
  name_ar: '',
  slug: '',
  icon: '',
}

export function CategoriesManager({ initialCategories }: { initialCategories: CategoryRecord[] }) {
  const [categories, setCategories] = useState(initialCategories)
  const [draft, setDraft] = useState<CategoryDraft>(EMPTY_DRAFT)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const editingCategory = useMemo(
    () => categories.find((category) => category.id === editingId) ?? null,
    [categories, editingId]
  )

  function resetForm() {
    setDraft(EMPTY_DRAFT)
    setEditingId(null)
  }

  function startEdit(category: CategoryRecord) {
    setEditingId(category.id)
    setDraft({
      name_en: category.name_en,
      name_ar: category.name_ar,
      slug: category.slug,
      icon: category.icon ?? '',
    })
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)

    const payload = {
      ...draft,
      icon: draft.icon.trim() || null,
      slug: draft.slug.trim() || generateSlug(draft.name_en),
      sort_order: editingCategory?.sort_order ?? categories.length,
    }

    const result = editingId
      ? await updateCategory(editingId, payload)
      : await createCategory(payload)

    setSaving(false)

    if (!result.success || !result.data) {
      toast.error(result.error ?? 'Failed to save category')
      return
    }

    const nextCategory = { ...result.data, showCount: editingCategory?.showCount ?? 0 } as CategoryRecord
    if (editingId) {
      setCategories((current) => current.map((category) => (
        category.id === editingId ? nextCategory : category
      )))
      toast.success('Category updated')
    } else {
      setCategories((current) => [...current, nextCategory].sort((a, b) => a.sort_order - b.sort_order))
      toast.success('Category created')
    }

    resetForm()
  }

  async function handleDelete(id: string) {
    setDeletingId(id)
    const result = await deleteCategory(id)
    setDeletingId(null)

    if (!result.success) {
      toast.error(result.error ?? 'Failed to delete category')
      return
    }

    setCategories((current) => current.filter((category) => category.id !== id))
    if (editingId === id) resetForm()
    toast.success('Category deleted')
  }

  async function handleMove(id: string, direction: 'up' | 'down') {
    const currentIndex = categories.findIndex((category) => category.id === id)
    const nextIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1
    if (currentIndex < 0 || nextIndex < 0 || nextIndex >= categories.length) return

    const next = [...categories]
    const [moved] = next.splice(currentIndex, 1)
    next.splice(nextIndex, 0, moved)

    const reordered = next.map((category, index) => ({ ...category, sort_order: index }))
    setCategories(reordered)

    const result = await reorderCategories(reordered.map((category) => category.id))
    if (!result.success) {
      toast.error(result.error ?? 'Failed to reorder categories')
      setCategories(categories)
      return
    }

    toast.success('Category order updated')
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
      <form onSubmit={handleSubmit} className="rounded-[6px] border border-[var(--line)] bg-[var(--bg-2)] p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
              {editingId ? 'Edit category' : 'New category'}
            </p>
            <h2 className="mt-2 text-xl font-semibold tracking-tight text-foreground">
              {editingId ? 'Update category' : 'Create category'}
            </h2>
          </div>
          {editingId && (
            <Button type="button" variant="ghost" size="icon-sm" onClick={resetForm} aria-label="Cancel editing">
              <X className="size-4" />
            </Button>
          )}
        </div>

        <div className="mt-6 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="category-name-en">English name</Label>
            <Input
              id="category-name-en"
              value={draft.name_en}
              onChange={(event) => {
                const name_en = event.target.value
                setDraft((current) => ({
                  ...current,
                  name_en,
                  slug: editingId ? current.slug : generateSlug(name_en),
                }))
              }}
              placeholder="Documentary"
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="category-name-ar">Arabic name</Label>
            <Input
              id="category-name-ar"
              dir="rtl"
              value={draft.name_ar}
              onChange={(event) => setDraft((current) => ({ ...current, name_ar: event.target.value }))}
              placeholder="وثائقي"
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="category-slug">Slug</Label>
            <Input
              id="category-slug"
              value={draft.slug}
              onChange={(event) => setDraft((current) => ({ ...current, slug: generateSlug(event.target.value) }))}
              placeholder="documentary"
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="category-icon">Eyebrow text or icon</Label>
            <Input
              id="category-icon"
              value={draft.icon}
              onChange={(event) => setDraft((current) => ({ ...current, icon: event.target.value }))}
              placeholder="Featured picks"
            />
          </div>
        </div>

        <div className="mt-6 flex items-center gap-3">
          <Button type="submit" disabled={saving}>
            {saving ? 'Saving...' : editingId ? 'Save category' : 'Create category'}
          </Button>
          {editingId && (
            <Button type="button" variant="outline" onClick={resetForm}>
              Cancel
            </Button>
          )}
        </div>
      </form>

      <div className="rounded-[6px] border border-[var(--line)] bg-[var(--bg-2)] p-6">
        <div className="flex items-end justify-between gap-4 border-b border-white/8 pb-5">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Browse categories</p>
            <h2 className="mt-2 text-xl font-semibold tracking-tight text-foreground">Category order and assignments</h2>
          </div>
          <div className="text-sm text-muted-foreground">{categories.length} categories</div>
        </div>

        <div className="mt-5 space-y-3">
          {categories.length === 0 && (
            <div className="rounded-[6px] border border-dashed border-[var(--line)] px-4 py-8 text-center text-sm text-muted-foreground">
              No categories yet.
            </div>
          )}

          {categories.map((category, index) => (
            <div
              key={category.id}
              className="flex flex-col gap-4 rounded-[6px] border border-[var(--line)] bg-[var(--bg-2)] px-4 py-4 lg:flex-row lg:items-center lg:justify-between"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-base font-medium text-foreground">{category.name_en}</span>
                  <span className="text-xs text-muted-foreground">/{category.slug}</span>
                </div>
                <div className="mt-1 text-sm text-muted-foreground">{category.name_ar}</div>
                <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted-foreground">
                  <span>{category.icon || 'No eyebrow text'}</span>
                  <span>{category.showCount} assigned shows</span>
                  <span>Order {category.sort_order + 1}</span>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="icon-sm"
                  disabled={index === 0}
                  onClick={() => handleMove(category.id, 'up')}
                  aria-label={`Move ${category.name_en} up`}
                >
                  <ArrowUp className="size-4" />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="icon-sm"
                  disabled={index === categories.length - 1}
                  onClick={() => handleMove(category.id, 'down')}
                  aria-label={`Move ${category.name_en} down`}
                >
                  <ArrowDown className="size-4" />
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={() => startEdit(category)}>
                  <Pencil className="size-3.5" />
                  Edit
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  disabled={deletingId === category.id}
                  onClick={() => handleDelete(category.id)}
                >
                  <Trash2 className="size-3.5" />
                  {deletingId === category.id ? 'Deleting...' : 'Delete'}
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
