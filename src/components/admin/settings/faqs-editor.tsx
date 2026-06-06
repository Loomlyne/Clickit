'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Pencil, Plus, Trash2, Loader2, HelpCircle } from 'lucide-react'
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { ConfirmDialog } from '@/components/admin/confirm-dialog'
import { upsertFaq, deleteFaq } from '@/app/[locale]/admin/actions'
import type { Faq } from '@/app/[locale]/admin/actions'
import { SettingsCard, SettingsField } from './settings-card'

type Draft = {
  id?: string
  question: string
  answer: string
  question_ar: string
  answer_ar: string
  sort_order: number
}

const emptyDraft = (nextOrder: number): Draft => ({
  question: '',
  answer: '',
  question_ar: '',
  answer_ar: '',
  sort_order: nextOrder,
})

export function FaqsEditor({ initial }: { initial: Faq[] }) {
  const [faqs, setFaqs] = useState<Faq[]>(initial)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Faq | null>(null)
  const [deleting, setDeleting] = useState(false)

  function openNew() {
    const nextOrder = faqs.length > 0
      ? Math.max(...faqs.map((f) => f.sort_order)) + 1
      : 1
    setDraft(emptyDraft(nextOrder))
  }

  function openEdit(faq: Faq) {
    setDraft({
      id: faq.id,
      question: faq.question,
      answer: faq.answer,
      question_ar: faq.question_ar ?? '',
      answer_ar: faq.answer_ar ?? '',
      sort_order: faq.sort_order,
    })
  }

  async function onSave() {
    if (!draft) return
    setSaving(true)
    const result = await upsertFaq(draft)
    setSaving(false)
    if (!result.success) {
      toast.error(result.error ?? 'Failed to save FAQ')
      return
    }
    const saved = result.data as Faq
    setFaqs((prev) =>
      draft.id
        ? prev.map((f) => (f.id === draft.id ? saved : f))
        : [...prev, saved]
    )
    setDraft(null)
    toast.success(draft.id ? 'FAQ updated' : 'FAQ created')
  }

  async function onDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    const result = await deleteFaq(deleteTarget.id)
    setDeleting(false)
    if (!result.success) {
      toast.error(result.error ?? 'Failed to delete FAQ')
      return
    }
    setFaqs((prev) => prev.filter((f) => f.id !== deleteTarget.id))
    setDeleteTarget(null)
    toast.success('FAQ deleted')
  }

  const sortedFaqs = [...faqs].sort((a, b) => a.sort_order - b.sort_order)

  return (
    <>
      <SettingsCard
        title="FAQs"
        description="Frequently asked questions shown on the landing page."
        action={
          <Button size="sm" className="gap-1.5" onClick={openNew}>
            <Plus className="size-3.5" />
            Add FAQ
          </Button>
        }
      >
        {sortedFaqs.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-10 text-center">
            <HelpCircle className="size-8 text-white/20" />
            <p className="text-sm text-white/40">No FAQs yet</p>
            <Button
              size="sm"
              variant="outline"
              onClick={openNew}
              className="mt-1"
            >
              <Plus className="mr-1.5 size-3.5" />
              Add first FAQ
            </Button>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8 hidden sm:table-cell">#</TableHead>
                <TableHead>Question</TableHead>
                <TableHead className="hidden md:table-cell">Answer preview</TableHead>
                <TableHead className="w-[88px] text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedFaqs.map((faq, i) => (
                <TableRow key={faq.id}>
                  <TableCell className="hidden text-xs text-white/30 sm:table-cell">
                    {i + 1}
                  </TableCell>
                  <TableCell className="max-w-[260px] font-medium text-white">
                    <span className="line-clamp-2">{faq.question}</span>
                  </TableCell>
                  <TableCell className="hidden max-w-[320px] text-xs text-white/50 md:table-cell">
                    <span className="line-clamp-2">{faq.answer}</span>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="size-8 text-white/50 hover:text-white"
                        onClick={() => openEdit(faq)}
                        aria-label="Edit FAQ"
                      >
                        <Pencil className="size-3.5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="size-8 text-white/50 hover:text-red-300"
                        onClick={() => setDeleteTarget(faq)}
                        aria-label="Delete FAQ"
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

      {/* Add / Edit Dialog */}
      <Dialog open={!!draft} onOpenChange={(open) => !open && setDraft(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{draft?.id ? 'Edit FAQ' : 'New FAQ'}</DialogTitle>
            <DialogDescription>
              This FAQ will appear in the landing page FAQ section when the FAQ
              section is enabled.
            </DialogDescription>
          </DialogHeader>

          {draft && (
            <div className="space-y-4 py-2">
              <SettingsField label="Question">
                <Input
                  value={draft.question}
                  maxLength={500}
                  placeholder="What is Clickit Story?"
                  onChange={(e) =>
                    setDraft((d) =>
                      d ? { ...d, question: e.target.value } : d
                    )
                  }
                  className="rounded-[12px]"
                />
              </SettingsField>

              <SettingsField label="Answer">
                <Textarea
                  value={draft.answer}
                  rows={5}
                  placeholder="Enter the answer..."
                  onChange={(e) =>
                    setDraft((d) =>
                      d ? { ...d, answer: e.target.value } : d
                    )
                  }
                  className="rounded-[12px] resize-y"
                />
              </SettingsField>

              <SettingsField
                label="Question (Arabic)"
                hint="Shown when the viewer switches to Arabic. Leave blank to fall back to English."
              >
                <Input
                  dir="rtl"
                  value={draft.question_ar}
                  maxLength={500}
                  placeholder="ما هي كليك إت ستوري؟"
                  onChange={(e) =>
                    setDraft((d) =>
                      d ? { ...d, question_ar: e.target.value } : d
                    )
                  }
                  className="rounded-[12px]"
                />
              </SettingsField>

              <SettingsField
                label="Answer (Arabic)"
                hint="Arabic answer shown on the Arabic locale. Leave blank to fall back to English."
              >
                <Textarea
                  dir="rtl"
                  value={draft.answer_ar}
                  rows={5}
                  placeholder="أدخل الإجابة..."
                  onChange={(e) =>
                    setDraft((d) =>
                      d ? { ...d, answer_ar: e.target.value } : d
                    )
                  }
                  className="rounded-[12px] resize-y"
                />
              </SettingsField>

              <SettingsField
                label="Sort Order"
                hint="Lower number = appears first"
              >
                <Input
                  type="number"
                  min={0}
                  value={draft.sort_order}
                  onChange={(e) =>
                    setDraft((d) =>
                      d
                        ? {
                            ...d,
                            sort_order: parseInt(e.target.value) || 0,
                          }
                        : d
                    )
                  }
                  className="rounded-[12px] w-24"
                />
              </SettingsField>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDraft(null)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button
              onClick={onSave}
              disabled={
                saving ||
                !draft?.question.trim() ||
                !draft?.answer.trim()
              }
            >
              {saving ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : null}
              {draft?.id ? 'Save Changes' : 'Create FAQ'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Delete FAQ"
        description={`Permanently delete this FAQ? This cannot be undone.`}
        confirmLabel="Delete"
        onConfirm={onDelete}
        destructive
        loading={deleting}
      />
    </>
  )
}
