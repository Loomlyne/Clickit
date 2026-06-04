'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Pencil, Plus, Trash2, Loader2, FileText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from '@/components/ui/sheet'
import { ConfirmDialog } from '@/components/admin/confirm-dialog'
import { upsertLegalPage, deleteLegalPage } from '@/app/[locale]/admin/actions'
import type { LegalPage } from '@/app/[locale]/admin/actions'
import { SettingsCard, SettingsField } from './settings-card'

function slugify(text: string) {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80)
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

type Draft = {
  id?: string
  slug: string
  title: string
  content: string
  sort_order: number
}

const emptyDraft = (): Draft => ({
  slug: '',
  title: '',
  content: '',
  sort_order: 0,
})

export function LegalPagesEditor({ initial }: { initial: LegalPage[] }) {
  const [pages, setPages] = useState<LegalPage[]>(initial)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<LegalPage | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [slugTouched, setSlugTouched] = useState(false)

  function openNew() {
    setDraft(emptyDraft())
    setSlugTouched(false)
  }

  function openEdit(page: LegalPage) {
    setDraft({
      id: page.id,
      slug: page.slug,
      title: page.title,
      content: page.content,
      sort_order: page.sort_order,
    })
    setSlugTouched(true)
  }

  function onTitleChange(title: string) {
    setDraft((d) =>
      d
        ? {
            ...d,
            title,
            slug: slugTouched ? d.slug : slugify(title),
          }
        : d
    )
  }

  async function onSave() {
    if (!draft) return
    setSaving(true)
    const result = await upsertLegalPage(draft)
    setSaving(false)
    if (!result.success) {
      toast.error(result.error ?? 'Failed to save legal page')
      return
    }
    const saved = result.data as LegalPage
    setPages((prev) =>
      draft.id
        ? prev.map((p) => (p.id === draft.id ? saved : p))
        : [...prev, saved]
    )
    setDraft(null)
    toast.success(draft.id ? 'Legal page updated' : 'Legal page created')
  }

  async function onDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    const result = await deleteLegalPage(deleteTarget.id)
    setDeleting(false)
    if (!result.success) {
      toast.error(result.error ?? 'Failed to delete legal page')
      return
    }
    setPages((prev) => prev.filter((p) => p.id !== deleteTarget.id))
    setDeleteTarget(null)
    toast.success('Legal page deleted')
  }

  return (
    <>
      <SettingsCard
        title="Legal Pages"
        description="Manage Terms of Use, Privacy Policy, and other legal documents."
        action={
          <Button size="sm" className="gap-1.5" onClick={openNew}>
            <Plus className="size-3.5" />
            Add Page
          </Button>
        }
      >
        {pages.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-10 text-center">
            <FileText className="size-8 text-white/20" />
            <p className="text-sm text-white/40">No legal pages yet</p>
            <Button size="sm" variant="outline" onClick={openNew} className="mt-1">
              <Plus className="mr-1.5 size-3.5" />
              Add first page
            </Button>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead className="hidden sm:table-cell">Slug</TableHead>
                <TableHead className="hidden md:table-cell">Updated</TableHead>
                <TableHead className="w-[88px] text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pages.map((page) => (
                <TableRow key={page.id}>
                  <TableCell className="font-medium text-white">
                    {page.title}
                  </TableCell>
                  <TableCell className="hidden font-mono text-xs text-white/50 sm:table-cell">
                    {page.slug}
                  </TableCell>
                  <TableCell className="hidden text-xs text-white/50 md:table-cell">
                    {formatDate(page.updated_at)}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="size-8 text-white/50 hover:text-white"
                        onClick={() => openEdit(page)}
                        aria-label="Edit"
                      >
                        <Pencil className="size-3.5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="size-8 text-white/50 hover:text-red-300"
                        onClick={() => setDeleteTarget(page)}
                        aria-label="Delete"
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </SettingsCard>

      {/* Add / Edit Sheet */}
      <Sheet open={!!draft} onOpenChange={(open) => !open && setDraft(null)}>
        <SheetContent side="right" className="w-full sm:max-w-2xl">
          <SheetHeader className="px-6 pt-6">
            <SheetTitle>{draft?.id ? 'Edit Legal Page' : 'New Legal Page'}</SheetTitle>
            <SheetDescription>
              Content supports plain text. Use line breaks for paragraphs.
            </SheetDescription>
          </SheetHeader>

          {draft && (
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
              <SettingsField label="Title">
                <Input
                  value={draft.title}
                  maxLength={200}
                  placeholder="Terms of Use"
                  onChange={(e) => onTitleChange(e.target.value)}
                  className="rounded-[12px]"
                />
              </SettingsField>

              <SettingsField label="Slug" hint="URL path: /legal/[slug]">
                <Input
                  value={draft.slug}
                  maxLength={80}
                  placeholder="terms-of-use"
                  onChange={(e) => {
                    setSlugTouched(true)
                    setDraft((d) =>
                      d ? { ...d, slug: slugify(e.target.value) } : d
                    )
                  }}
                  className="rounded-[12px] font-mono text-sm"
                />
              </SettingsField>

              <SettingsField label="Sort Order" hint="Lower number = displayed first">
                <Input
                  type="number"
                  min={0}
                  value={draft.sort_order}
                  onChange={(e) =>
                    setDraft((d) =>
                      d
                        ? { ...d, sort_order: parseInt(e.target.value) || 0 }
                        : d
                    )
                  }
                  className="rounded-[12px] w-24"
                />
              </SettingsField>

              <SettingsField label="Content">
                <Textarea
                  value={draft.content}
                  rows={20}
                  placeholder="Enter the full legal text here..."
                  onChange={(e) =>
                    setDraft((d) => (d ? { ...d, content: e.target.value } : d))
                  }
                  className="rounded-[12px] font-mono text-sm leading-relaxed resize-y"
                />
              </SettingsField>
            </div>
          )}

          <SheetFooter className="flex-row justify-end gap-2 border-t border-white/8 px-6 pb-6 pt-4">
            <Button
              variant="outline"
              onClick={() => setDraft(null)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button onClick={onSave} disabled={saving || !draft?.title || !draft?.slug}>
              {saving ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : null}
              {draft?.id ? 'Save Changes' : 'Create Page'}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* Delete confirmation */}
      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Delete legal page"
        description={`Permanently delete "${deleteTarget?.title}"? This cannot be undone.`}
        confirmLabel="Delete"
        onConfirm={onDelete}
        destructive
        loading={deleting}
      />
    </>
  )
}
