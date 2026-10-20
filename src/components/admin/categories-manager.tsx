'use client'

import { Fragment, useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronDown, ChevronUp, Pencil, Plus, Trash2, X } from 'lucide-react'
import { toast } from 'sonner'

import { useTranslations } from 'next-intl'

import {
  createCategory,
  deleteCategory,
  reorderCategories,
  updateCategory,
} from '@/app/[locale]/admin/actions'
import {
  AdminPageHeader,
  AdminPanel,
  AdminTableShell,
} from '@/components/admin/admin-shell'
import { ConfirmDialog } from '@/components/admin/confirm-dialog'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
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
  const t = useTranslations('admin.categories')
  const [rawInput, setRawInput] = useState(value ?? '')
  // Re-sync the text field when the value prop changes (derived during render).
  const [prevValue, setPrevValue] = useState(value)
  if (prevValue !== value) {
    setPrevValue(value)
    setRawInput(value ?? '')
  }

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
      <Label>{t('colorLabel')}</Label>

      <div className="flex items-center gap-2">
        <div className="relative size-11 shrink-0 cursor-pointer overflow-hidden rounded-lg border border-[var(--line-2)]">
          <div
            className="size-full"
            style={{
              background:
                previewColor ??
                'conic-gradient(from 0deg, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00)',
            }}
          />
          <input
            type="color"
            value={previewColor ?? '#000000'}
            onChange={handleNativeColor}
            className="absolute inset-0 cursor-pointer opacity-0"
            aria-label={t('colorPickerOpen')}
          />
        </div>

        <Input
          value={rawInput}
          onChange={handleTextChange}
          placeholder="#F8C623"
          maxLength={7}
          className="w-32 font-mono text-sm"
          aria-label={t('colorHexAria')}
          spellCheck={false}
        />

        {value && (
          <button
            type="button"
            onClick={() => {
              onChange(null)
              setRawInput('')
            }}
            className="inline-flex min-h-11 items-center px-2 text-[13px] text-[var(--text-mute)] transition-colors hover:text-[var(--text)]"
          >
            {t('colorClear')}
          </button>
        )}

        {previewColor && (
          <span
            className="size-5 shrink-0 rounded-full border border-[var(--line-2)]"
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
  const t = useTranslations('admin.categories')
  const tCommon = useTranslations('common')
  return (
    <form
      onSubmit={onSubmit}
      className="rounded-lg border border-[var(--line)] bg-[var(--bg-2)] p-4 md:p-5"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold tracking-[0.12em] text-[var(--text-mute)] uppercase">
            {editing ? t('eyebrowEdit') : t('eyebrowNew')}
          </p>
          <h3 className="text-foreground mt-1 text-lg font-semibold tracking-tight">
            {editing ? t('titleEdit') : t('titleNew')}
          </h3>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={onCancel}
          aria-label={t('closeEditorAria')}
        >
          <X className="size-4" />
        </Button>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-[1fr_1fr_0.9fr]">
        <div className="space-y-1.5">
          <Label htmlFor="category-name-en">{t('englishNameLabel')}</Label>
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
            placeholder={t('placeholderEnglish')}
            required
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="category-name-ar">{t('arabicNameLabel')}</Label>
          <Input
            id="category-name-ar"
            dir="rtl"
            value={draft.name_ar}
            onChange={(event) =>
              onDraftChange((current) => ({
                ...current,
                name_ar: event.target.value,
              }))
            }
            placeholder={t('placeholderArabic')}
            required
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="category-slug">{t('slugLabel')}</Label>
          <Input
            id="category-slug"
            value={draft.slug}
            onChange={(event) =>
              onDraftChange((current) => ({
                ...current,
                slug: generateSlug(event.target.value),
              }))
            }
            placeholder={t('placeholderSlug')}
            required
          />
        </div>
      </div>

      <div
        className={cn(
          'mt-5 rounded-lg border border-[var(--line)] bg-[var(--bg-2)] p-4 transition-[border-left-color]',
          draft.color && 'border-l-[3px]'
        )}
        style={draft.color ? { borderLeftColor: draft.color } : undefined}
      >
        <ColorPicker
          value={draft.color}
          onChange={(color) =>
            onDraftChange((current) => ({ ...current, color }))
          }
        />
      </div>

      <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
        <Button type="submit" disabled={saving}>
          {saving
            ? t('saving')
            : editing
              ? t('saveCategory')
              : t('createCategory')}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel}>
          {tCommon('cancel')}
        </Button>
      </div>
    </form>
  )
}

export function CategoriesManager({
  initialCategories,
}: {
  initialCategories: CategoryRecord[]
}) {
  const router = useRouter()
  const t = useTranslations('admin.dashboard')
  const tCat = useTranslations('admin.categories')
  const tCommon = useTranslations('common')
  const [categories, setCategories] = useState(initialCategories)
  const [draft, setDraft] = useState<CategoryDraft>(EMPTY_DRAFT)
  const [editorState, setEditorState] = useState<EditorState>(null)
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = useState(false)
  const [bulkDeleting, setBulkDeleting] = useState(false)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [pendingOrderId, setPendingOrderId] = useState<string | null>(null)
  const [isReordering, startReorderTransition] = useTransition()

  const editingCategory = useMemo(
    () =>
      editorState?.mode === 'edit'
        ? (categories.find(
            (category) => category.id === editorState.categoryId
          ) ?? null)
        : null,
    [categories, editorState]
  )

  const isCreateOpen = editorState?.mode === 'create'
  const editingId = editingCategory?.id ?? null
  const categoryIds = categories.map((category) => category.id)
  const selectedSet = new Set(selectedIds)
  const selectedCount = selectedIds.length
  const allSelected =
    categoryIds.length > 0 && categoryIds.every((id) => selectedSet.has(id))

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

  function toggleCategorySelection(categoryId: string, checked: boolean) {
    setSelectedIds((current) =>
      checked
        ? current.includes(categoryId)
          ? current
          : [...current, categoryId]
        : current.filter((id) => id !== categoryId)
    )
  }

  function toggleAllSelection(checked: boolean) {
    setSelectedIds(checked ? categoryIds : [])
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
      toast.error(result.error ?? tCat('toastSaveFailed'))
      return
    }

    const nextCategory = {
      ...result.data,
      showCount: editingCategory?.showCount ?? 0,
    } as CategoryRecord
    if (editingId) {
      setCategories((current) =>
        current.map((category) =>
          category.id === editingId ? nextCategory : category
        )
      )
      toast.success(tCat('toastUpdated'))
    } else {
      setCategories((current) =>
        [...current, nextCategory].sort((a, b) => a.sort_order - b.sort_order)
      )
      toast.success(tCat('toastCreated'))
    }

    resetEditor()
  }

  async function handleDelete(id: string) {
    setDeletingId(id)
    const result = await deleteCategory(id)
    setDeletingId(null)

    if (!result.success) {
      toast.error(result.error ?? tCat('toastDeleteFailed'))
      return
    }

    setCategories((current) => current.filter((category) => category.id !== id))
    if (editingId === id) resetEditor()
    toast.success(tCat('toastDeleted'))
  }

  async function handleBulkDelete() {
    if (selectedIds.length === 0) return
    const ids = selectedIds
    setBulkDeleting(true)
    for (const id of ids) {
      const result = await deleteCategory(id)
      if (!result.success) {
        setBulkDeleting(false)
        toast.error(result.error ?? tCat('toastDeleteFailed'))
        return
      }
    }
    setBulkDeleting(false)
    setBulkDeleteDialogOpen(false)
    setSelectedIds([])
    setCategories((current) =>
      current.filter((category) => !ids.includes(category.id))
    )
    if (editingId && ids.includes(editingId)) resetEditor()
    toast.success(tCat('bulkDeletedToast', { count: ids.length }))
  }

  function handleReorder(categoryId: string, direction: 'up' | 'down') {
    const currentIndex = categories.findIndex(
      (category) => category.id === categoryId
    )
    const adjacentIndex =
      direction === 'up' ? currentIndex - 1 : currentIndex + 1
    if (
      currentIndex < 0 ||
      adjacentIndex < 0 ||
      adjacentIndex >= categories.length
    ) {
      return
    }

    const previousCategories = categories
    const nextCategories = [...categories]
    const moving = nextCategories[currentIndex]!
    nextCategories[currentIndex] = nextCategories[adjacentIndex]!
    nextCategories[adjacentIndex] = moving
    setPendingOrderId(categoryId)
    setCategories(nextCategories)

    startReorderTransition(async () => {
      const result = await reorderCategories(
        nextCategories.map((category) => category.id)
      )
      setPendingOrderId(null)
      if (!result.success) {
        setCategories(previousCategories)
        toast.error(result.error ?? tCat('toastReorderFailed'))
        return
      }
      router.refresh()
    })
  }

  return (
    <TooltipProvider delayDuration={300}>
      <AdminPageHeader
        title={t('categories')}
        description={t('categoryCountLabel', { count: categories.length })}
        action={
          selectedCount > 0 ? (
            <Button
              type="button"
              variant="destructive"
              onClick={() => setBulkDeleteDialogOpen(true)}
            >
              <Trash2 className="size-4" />
              {tCat('bulkDeleteButton', { count: selectedCount })}
            </Button>
          ) : (
            <Button type="button" onClick={startCreate}>
              <Plus className="size-4" />
              {tCat('addCategory')}
            </Button>
          )
        }
      />

      <AdminPanel className="overflow-hidden p-0">
        <AdminTableShell className="rounded-none border-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox
                    checked={
                      allSelected
                        ? true
                        : selectedIds.length > 0
                          ? 'indeterminate'
                          : false
                    }
                    onCheckedChange={(checked) =>
                      toggleAllSelection(checked === true)
                    }
                    aria-label={tCat('selectAllAria')}
                  />
                </TableHead>
                <TableHead>{tCat('colCategory')}</TableHead>
                <TableHead className="hidden md:table-cell">
                  {tCat('colArabicName')}
                </TableHead>
                <TableHead className="hidden w-36 md:table-cell">
                  {tCat('colColor')}
                </TableHead>
                <TableHead className="w-32">{tCat('colAssigned')}</TableHead>
                <TableHead className="w-52 text-right">
                  {tCat('colActions')}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isCreateOpen && (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="bg-[var(--bg-2)] whitespace-normal"
                  >
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
                  <TableCell
                    colSpan={6}
                    className="text-muted-foreground py-12 text-center"
                  >
                    {tCat('empty')}
                  </TableCell>
                </TableRow>
              )}

              {categories.map((category, index) => {
                const isEditingRow =
                  editorState?.mode === 'edit' &&
                  editorState.categoryId === category.id

                return (
                  <Fragment key={category.id}>
                    <TableRow
                      data-state={
                        selectedSet.has(category.id) ? 'selected' : undefined
                      }
                    >
                      <TableCell>
                        <Checkbox
                          checked={selectedSet.has(category.id)}
                          onCheckedChange={(checked) =>
                            toggleCategorySelection(
                              category.id,
                              checked === true
                            )
                          }
                          aria-label={tCat('selectCategoryAria', {
                            name: category.name_en,
                          })}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="min-w-[180px]">
                          <div className="text-foreground font-medium">
                            {category.name_en}
                          </div>
                          <div className="text-muted-foreground mt-1 text-xs">
                            /{category.slug}
                          </div>
                          <div className="text-muted-foreground mt-1 text-xs md:hidden">
                            {category.name_ar}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground hidden md:table-cell">
                        {category.name_ar}
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        {category.color ? (
                          <div className="flex items-center gap-2">
                            <span
                              className="size-4 shrink-0 rounded-full border border-[var(--line)]"
                              style={{ background: category.color }}
                            />
                            <span className="text-muted-foreground font-mono text-xs">
                              {category.color}
                            </span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground/40 text-xs">
                            —
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {category.showCount}
                      </TableCell>
                      <TableCell>
                        <div className="flex min-w-[168px] items-center justify-end gap-2">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon-sm"
                                disabled={
                                  isReordering ||
                                  pendingOrderId === category.id ||
                                  index === 0
                                }
                                onClick={() => handleReorder(category.id, 'up')}
                                aria-label={tCat('moveUpAria', {
                                  name: category.name_en,
                                })}
                              >
                                <ChevronUp className="size-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>{tCat('moveUp')}</TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon-sm"
                                disabled={
                                  isReordering ||
                                  pendingOrderId === category.id ||
                                  index === categories.length - 1
                                }
                                onClick={() =>
                                  handleReorder(category.id, 'down')
                                }
                                aria-label={tCat('moveDownAria', {
                                  name: category.name_en,
                                })}
                              >
                                <ChevronDown className="size-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>{tCat('moveDown')}</TooltipContent>
                          </Tooltip>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => startEdit(category)}
                            aria-label={tCat('editAria', {
                              name: category.name_en,
                            })}
                          >
                            <Pencil className="size-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="destructive"
                            size="icon-sm"
                            disabled={deletingId === category.id}
                            onClick={() => handleDelete(category.id)}
                            aria-label={tCat('deleteAria', {
                              name: category.name_en,
                            })}
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>

                    {isEditingRow && (
                      <TableRow>
                        <TableCell
                          colSpan={6}
                          className="bg-[var(--bg-2)] whitespace-normal"
                        >
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
      <ConfirmDialog
        open={bulkDeleteDialogOpen}
        onOpenChange={setBulkDeleteDialogOpen}
        title={tCat('bulkDeleteTitle')}
        description={tCat('bulkDeleteDescription', { count: selectedCount })}
        confirmLabel={tCommon('delete')}
        destructive
        loading={bulkDeleting}
        onConfirm={handleBulkDelete}
      />
    </TooltipProvider>
  )
}
