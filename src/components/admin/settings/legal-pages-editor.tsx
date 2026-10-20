'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { useArabicMissingToast } from '@/components/admin/arabic-missing-toast'
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
  title_ar: string
  content_ar: string
  sort_order: number
}

const emptyDraft = (): Draft => ({
  slug: '',
  title: '',
  content: '',
  title_ar: '',
  content_ar: '',
  sort_order: 0,
})

export function LegalPagesEditor({ initial }: { initial: LegalPage[] }) {
  const t = useTranslations('admin.settings')
  const warnArabicMissing = useArabicMissingToast()
  const tc = useTranslations('common')
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
      title_ar: page.title_ar ?? '',
      content_ar: page.content_ar ?? '',
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
      toast.error(result.error ?? t('legalSaveFailed'))
      return
    }
    const saved = result.data as LegalPage
    setPages((prev) =>
      draft.id
        ? prev.map((p) => (p.id === draft.id ? saved : p))
        : [...prev, saved]
    )
    setDraft(null)
    if (!warnArabicMissing(result)) toast.success(draft.id ? t('legalUpdated') : t('legalCreated'))
  }

  async function onDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    const result = await deleteLegalPage(deleteTarget.id)
    setDeleting(false)
    if (!result.success) {
      toast.error(result.error ?? t('legalDeleteFailed'))
      return
    }
    setPages((prev) => prev.filter((p) => p.id !== deleteTarget.id))
    setDeleteTarget(null)
    toast.success(t('legalDeleted'))
  }

  return (
    <>
      <SettingsCard
        title={t('legalCardTitle')}
        description={t('legalCardDescription')}
        action={
          <Button size="sm" className="gap-1.5" onClick={openNew}>
            <Plus className="size-3.5" />
            {t('legalAdd')}
          </Button>
        }
      >
        {pages.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-10 text-center">
            <FileText className="size-8 text-[var(--text-mute)]" />
            <p className="text-sm text-[var(--text-mute)]">{t('legalEmpty')}</p>
            <Button
              size="sm"
              variant="outline"
              onClick={openNew}
              className="mt-1"
            >
              <Plus className="me-1.5 size-3.5" />
              {t('legalAddFirst')}
            </Button>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('legalColTitle')}</TableHead>
                <TableHead className="hidden sm:table-cell">
                  {t('legalColSlug')}
                </TableHead>
                <TableHead className="hidden md:table-cell">
                  {t('legalColUpdated')}
                </TableHead>
                <TableHead className="w-[88px] text-end">
                  {t('legalColActions')}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pages.map((page) => (
                <TableRow key={page.id}>
                  <TableCell className="font-medium text-[var(--text)]">
                    {page.title}
                  </TableCell>
                  <TableCell className="hidden font-mono text-xs text-[var(--text-mute)] sm:table-cell">
                    {page.slug}
                  </TableCell>
                  <TableCell className="hidden text-xs text-[var(--text-mute)] md:table-cell">
                    {formatDate(page.updated_at)}
                  </TableCell>
                  <TableCell className="text-end">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="size-8 text-[var(--text-mute)] hover:text-[var(--text)]"
                        onClick={() => openEdit(page)}
                        aria-label={tc('edit')}
                      >
                        <Pencil className="size-3.5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="hover:text-brand-red-safe size-8 text-[var(--text-mute)]"
                        onClick={() => setDeleteTarget(page)}
                        aria-label={tc('delete')}
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
            <SheetTitle>
              {draft?.id ? t('legalSheetEditTitle') : t('legalSheetNewTitle')}
            </SheetTitle>
            <SheetDescription>{t('legalSheetDescription')}</SheetDescription>
          </SheetHeader>

          {draft && (
            <div className="flex-1 space-y-4 overflow-y-auto px-6 py-4">
              <SettingsField label={t('legalTitleLabel')}>
                <Input
                  value={draft.title}
                  maxLength={200}
                  placeholder={t('legalTitlePlaceholder')}
                  onChange={(e) => onTitleChange(e.target.value)}
                  className="rounded-lg"
                />
              </SettingsField>

              <SettingsField
                label={t('legalTitleArLabel')}
                hint={t('legalTitleArHint')}
              >
                <Input
                  dir="rtl"
                  value={draft.title_ar}
                  maxLength={200}
                  placeholder={t('legalTitleArPlaceholder')}
                  onChange={(e) =>
                    setDraft((d) =>
                      d ? { ...d, title_ar: e.target.value } : d
                    )
                  }
                  className="rounded-lg"
                />
              </SettingsField>

              <SettingsField
                label={t('legalSlugLabel')}
                hint={t('legalSlugHint')}
              >
                <Input
                  value={draft.slug}
                  maxLength={80}
                  placeholder={t('legalSlugPlaceholder')}
                  onChange={(e) => {
                    setSlugTouched(true)
                    setDraft((d) =>
                      d ? { ...d, slug: slugify(e.target.value) } : d
                    )
                  }}
                  className="rounded-lg font-mono text-sm"
                />
              </SettingsField>

              <SettingsField
                label={t('sortOrderLabel')}
                hint={t('legalSortHint')}
              >
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
                  className="w-24 rounded-lg"
                />
              </SettingsField>

              <SettingsField label={t('legalContentLabel')}>
                <Textarea
                  value={draft.content}
                  rows={20}
                  placeholder={t('legalContentPlaceholder')}
                  onChange={(e) =>
                    setDraft((d) => (d ? { ...d, content: e.target.value } : d))
                  }
                  className="resize-y rounded-lg font-mono text-sm leading-relaxed"
                />
              </SettingsField>

              <SettingsField
                label={t('legalContentArLabel')}
                hint={t('legalContentArHint')}
              >
                <Textarea
                  dir="rtl"
                  value={draft.content_ar}
                  rows={20}
                  placeholder={t('legalContentArPlaceholder')}
                  onChange={(e) =>
                    setDraft((d) =>
                      d ? { ...d, content_ar: e.target.value } : d
                    )
                  }
                  className="resize-y rounded-lg font-mono text-sm leading-relaxed"
                />
              </SettingsField>
            </div>
          )}

          <SheetFooter className="flex-row justify-end gap-2 border-t border-[var(--line)] px-6 pt-4 pb-6">
            <Button
              variant="outline"
              onClick={() => setDraft(null)}
              disabled={saving}
            >
              {tc('cancel')}
            </Button>
            <Button
              onClick={onSave}
              disabled={saving || !draft?.title || !draft?.slug}
            >
              {saving ? <Loader2 className="me-2 size-4 animate-spin" /> : null}
              {draft?.id ? t('legalSaveChanges') : t('legalCreate')}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* Delete confirmation */}
      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title={t('legalDeleteTitle')}
        description={t('legalDeleteConfirm', {
          title: deleteTarget?.title ?? '',
        })}
        confirmLabel={tc('delete')}
        onConfirm={onDelete}
        destructive
        loading={deleting}
      />
    </>
  )
}
