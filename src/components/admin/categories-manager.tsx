'use client'

import { Fragment, useEffect, useMemo, useState } from 'react'
import { ArrowDown, ArrowUp, Pencil, Plus, Trash2, X } from 'lucide-react'
import { toast } from 'sonner'

import { createCategory, deleteCategory, reorderCategories, updateCategory } from '@/app/[locale]/admin/actions'
import { AdminPanel, AdminTableShell, AdminToolbar } from '@/components/admin/admin-shell'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { cn } from '@/lib/utils'
import { generateSlug } from '@/lib/slug'
import type { Database } from '@/lib/database.types'

type CategoryRecord = Database['public']['Tables']['categories']['Row'] & {
  showCount: number
}

type CategoryDraft = {
  name_en: string
  name_ar: string
  slug: string
  color: string | null
}

type EditorState =
  | { mode: 'create' }
  | { mode: 'edit'; categoryId: string }
  | null

const EMPTY_DRAFT: CategoryDraft = {
  name_en: '',
  name_ar: '',
  slug: '',
  color: null,
}

const HEX_RE = /^#[0-9a-fA-F]{6}$/

function ColorPicker({
  value,
  onChange,
}: {
  value: string | null
  onChange: (color: string | null) => void
}) {
  const [rawInput, setRawInput] = useState(value ?? '')

  useEffect(() => {
    setRawInput(value ?? '')
  }, [value])

  const isValidHex = HEX_RE.test(rawInput)
  const previewColor = isValidHex ? rawInput : null

  function handleTextChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value
    setRawInput(raw)
    if (HEX_RE.test(raw)) onChange(raw.toUpperCase())
  }

  function handleNativeColor(e: React.ChangeEvent<HTMLInputElement>) {
    const hex = e.target.value.toUpperCase()
    setRawInput(hex)
    onChange(hex)
  }

  return (
    <div className="space-y-3">
      <Label>Category color</Label>

      <div className="flex items-center gap-2">
        {/* OS color wheel trigger */}
        <div className="relative size-8 shrink-0 cursor-pointer overflow-hidden rounded-md border border-white/15">
          <div
            className="size-full"
            style={{
              background: previewColor
                ?? 'conic-gradient(from 0deg, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00)',
            }}
          />
          <input
            type="color"
            value={previewColor ?? '#000000'}
            onChange={handleNativeColor}
            className="absolute inset-0 cursor-pointer opacity-0"
            aria-label="Open color picker"
          />
        </div>

        <Input
          value={rawInput}
          onChange={handleTextChange}
          placeholder="#F8C623"
          maxLength={7}
          className="w-32 font-mono text-sm"
          aria-label="Hex color value"
          spellCheck={false}
        />

        {value && (
          <button
            type="button"
            onClick={() => { onChange(null); setRawInput('') }}
            className="text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            Clear
          </button>
        )}

        {previewColor && (
          <span
            className="size-5 shrink-0 rounded-full border border-white/15"
            style={{ background: previewColor }}
            aria-hidden
          />
        )}
      </div>
    </div>
  )
}

function CategoryEditor({
  draft,
  saving,
  editing,
  onCancel,
  onSubmit,
  onDraftChange,
}: {
  draft: CategoryDraft
  saving: boolean
  editing: boolean
  onCancel: () => void
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => Promise<void>
  onDraftChange: React.Dispatch<React.SetStateAction<CategoryDraft>>
}) {
  return (
    <form onSubmit={onSubmit} className="rounded-lg border border-white/8 bg-white/[0.02] p-4 md:p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
            {editing ? 'Edit category' : 'New category'}
          </p>
          <h3 className="mt-1 text-lg font-semibold tracking-tight text-foreground">
            {editing ? 'Update category' : 'Create category'}
          </h3>
        </div>
        <Button type="button" variant="ghost" size="icon-sm" onClick={onCancel} aria-label="Close category editor">
          <X className="size-4" />
        </Button>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-[1fr_1fr_0.9fr]">
        <div className="space-y-1.5">
          <Label htmlFor="category-name-en">English name</Label>
          <Input
            id="category-name-en"
            value={draft.name_en}
            onChange={(event) => {
              const name_en = event.target.value
              onDraftChange((current) => ({
                ...current,
                name_en,
                slug: editing ? current.slug : generateSlug(name_en),
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
            onChange={(event) => onDraftChange((current) => ({ ...current, name_ar: event.target.value }))}
            placeholder="وثائقي"
            required
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="category-slug">Slug</Label>
          <Input
            id="category-slug"
            value={draft.slug}
            onChange={(event) => onDraftChange((current) => ({ ...current, slug: generateSlug(event.target.value) }))}
            placeholder="documentary"
            required
          />
        </div>
      </div>

      <div
        className={cn(
          'mt-5 rounded-lg border border-white/8 bg-white/[0.02] p-4 transition-[border-left-color]',
          draft.color && 'border-l-[3px]',
        )}
        style={draft.color ? { borderLeftColor: draft.color } : undefined}
      >
        <ColorPicker
          value={draft.color}
          onChange={(color) => onDraftChange((current) => ({ ...current, color }))}
        />
      </div>

      <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
        <Button type="submit" disabled={saving}>
          {saving ? 'Saving...' : editing ? 'Save category' : 'Create category'}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  )
}

export function CategoriesManager({ initialCategories }: { initialCategories: CategoryRecord[] }) {
  const [categories, setCategories] = useState(initialCategories)
  const [draft, setDraft] = useState<CategoryDraft>(EMPTY_DRAFT)
  const [editorState, setEditorState] = useState<EditorState>(null)
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const editingCategory = useMemo(
    () => editorState?.mode === 'edit'
      ? categories.find((category) => category.id === editorState.categoryId) ?? null
      : null,
    [categories, editorState]
  )

  const isCreateOpen = editorState?.mode === 'create'
  const editingId = editingCategory?.id ?? null

  function resetEditor() {
    setDraft(EMPTY_DRAFT)
    setEditorState(null)
  }

  function startCreate() {
    setDraft(EMPTY_DRAFT)
    setEditorState({ mode: 'create' })
  }

  function startEdit(category: CategoryRecord) {
    setDraft({
      name_en: category.name_en,
      name_ar: category.name_ar,
      slug: category.slug,
      color: category.color ?? null,
    })
    setEditorState({ mode: 'edit', categoryId: category.id })
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)

    const payload = {
      name_en: draft.name_en.trim(),
      name_ar: draft.name_ar.trim(),
      slug: draft.slug.trim() || generateSlug(draft.name_en),
      sort_order: editingCategory?.sort_order ?? categories.length,
      color: draft.color ?? null,
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

    resetEditor()
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
    if (editingId === id) resetEditor()
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
    <AdminPanel className="p-0">
      <div className="p-5 md:p-6">
        <AdminToolbar
          eyebrow="Browse categories"
          title="Category order and assignments"
          description="Curate the browse rails and keep category membership manually controlled from the show editor."
          actions={
            <Button type="button" onClick={startCreate}>
              <Plus className="size-4" />
              Add category
            </Button>
          }
        >
          <div className="text-sm text-muted-foreground">{categories.length} categories</div>
        </AdminToolbar>
      </div>

      <AdminTableShell className="rounded-none border-x-0 border-b-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Category</TableHead>
              <TableHead className="hidden md:table-cell">Arabic name</TableHead>
              <TableHead className="hidden w-36 md:table-cell">Color</TableHead>
              <TableHead className="w-32">Assigned</TableHead>
              <TableHead className="w-24">Order</TableHead>
              <TableHead className="w-52 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isCreateOpen && (
              <TableRow>
                <TableCell colSpan={6} className="whitespace-normal bg-white/[0.015]">
                  <CategoryEditor
                    draft={draft}
                    saving={saving}
                    editing={false}
                    onCancel={resetEditor}
                    onSubmit={handleSubmit}
                    onDraftChange={setDraft}
                  />
                </TableCell>
              </TableRow>
            )}

            {categories.length === 0 && !isCreateOpen && (
              <TableRow>
                <TableCell colSpan={6} className="py-12 text-center text-muted-foreground">
                  No categories yet.
                </TableCell>
              </TableRow>
            )}

            {categories.map((category, index) => {
              const isEditingRow = editorState?.mode === 'edit' && editorState.categoryId === category.id

              return (
                <Fragment key={category.id}>
                  <TableRow>
                    <TableCell>
                      <div className="min-w-[180px]">
                        <div className="font-medium text-foreground">{category.name_en}</div>
                        <div className="mt-1 text-xs text-muted-foreground">/{category.slug}</div>
                        <div className="mt-1 text-xs text-muted-foreground md:hidden">{category.name_ar}</div>
                      </div>
                    </TableCell>
                    <TableCell className="hidden text-muted-foreground md:table-cell">{category.name_ar}</TableCell>
                    <TableCell className="hidden md:table-cell">
                      {category.color ? (
                        <div className="flex items-center gap-2">
                          <span
                            className="size-4 shrink-0 rounded-full border border-white/10"
                            style={{ background: category.color }}
                          />
                          <span className="font-mono text-xs text-muted-foreground">{category.color}</span>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground/40">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{category.showCount}</TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">#{category.sort_order + 1}</TableCell>
                    <TableCell>
                      <div className="flex min-w-[190px] items-center justify-end gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          disabled={index === 0}
                          onClick={() => handleMove(category.id, 'up')}
                          aria-label={`Move ${category.name_en} up`}
                        >
                          <ArrowUp className="size-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          disabled={index === categories.length - 1}
                          onClick={() => handleMove(category.id, 'down')}
                          aria-label={`Move ${category.name_en} down`}
                        >
                          <ArrowDown className="size-4" />
                        </Button>
                        <Button type="button" variant="ghost" size="icon-sm" onClick={() => startEdit(category)} aria-label={`Edit ${category.name_en}`}>
                          <Pencil className="size-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          className="text-red-400 hover:text-red-300"
                          disabled={deletingId === category.id}
                          onClick={() => handleDelete(category.id)}
                          aria-label={`Delete ${category.name_en}`}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>

                  {isEditingRow && (
                    <TableRow>
                      <TableCell colSpan={6} className="whitespace-normal bg-white/[0.015]">
                        <CategoryEditor
                          draft={draft}
                          saving={saving}
                          editing
                          onCancel={resetEditor}
                          onSubmit={handleSubmit}
                          onDraftChange={setDraft}
                        />
                      </TableCell>
                    </TableRow>
                  )}
                </Fragment>
              )
            })}
          </TableBody>
        </Table>
      </AdminTableShell>
    </AdminPanel>
  )
}
