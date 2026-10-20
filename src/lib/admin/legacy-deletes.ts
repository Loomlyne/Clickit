// Audited deletes for the single-row admin tables (legal page, FAQ, review, short):
// snapshot the row, pending audit row, delete, terminal audit row with the same
// attempt_id. Nothing is deleted when the pending row cannot be written.
// No next/* imports: revalidation stays in the actions.ts wrapper.
import { runAuditedDelete } from './compensation.ts'
import { parseId } from './schemas.ts'
import type { AdminDb, AuditWriter, CoreResult } from './ports'

type Deps = { audit: AuditWriter; adminUserId: string }

type Spec = {
  table: 'legal_pages' | 'faqs' | 'reviews' | 'shorts'
  entity: Parameters<AuditWriter>[0]['entity']
  idLabel: string
  notFound: string
  /** Columns kept in the audit row so the deleted content can be recognised or restored by hand. */
  snapshot: string[]
}

export const LEGAL_PAGE_DELETE: Spec = {
  table: 'legal_pages',
  entity: 'legal_page',
  idLabel: 'legal page',
  notFound: 'Legal page not found.',
  snapshot: ['slug', 'title', 'title_ar', 'content', 'content_ar'],
}

export const FAQ_DELETE: Spec = {
  table: 'faqs',
  entity: 'faq',
  idLabel: 'FAQ',
  notFound: 'FAQ not found.',
  snapshot: ['question', 'question_ar', 'answer', 'answer_ar'],
}

export const REVIEW_DELETE: Spec = {
  table: 'reviews',
  entity: 'review',
  idLabel: 'review',
  notFound: 'Review not found.',
  snapshot: ['show_id', 'user_id', 'stars', 'body'],
}

export const SHORT_DELETE: Spec = {
  table: 'shorts',
  entity: 'short',
  idLabel: 'short',
  notFound: 'Short not found.',
  snapshot: ['title', 'youtube_video_id', 'channel_name', 'archived'],
}

export async function deleteRowAuditedCore(
  db: AdminDb,
  deps: Deps,
  spec: Spec,
  rawId: unknown
): Promise<CoreResult> {
  const pid = parseId(rawId, spec.idLabel)
  if (!pid.ok) return { success: false, error: pid.error, wrote: false }
  const id = pid.value

  const read = await db
    .from(spec.table)
    .select(['id', ...spec.snapshot].join(', '))
    .eq('id', id)
    .maybeSingle()
  if (read.error) return { success: false, error: read.error.message, wrote: false }
  if (!read.data) return { success: false, error: spec.notFound, wrote: false }

  const row = read.data as unknown as Record<string, unknown>
  const snapshot: Record<string, unknown> = {}
  for (const col of spec.snapshot) snapshot[col] = row[col] ?? null

  const res = await runAuditedDelete({
    audit: deps.audit,
    adminUserId: deps.adminUserId,
    action: 'delete',
    entity: spec.entity,
    entityId: id,
    context: { id, snapshot },
    steps: [
      {
        name: `delete_${spec.table}`,
        run: async () => {
          const { error } = await db.from(spec.table).delete().eq('id', id)
          return { error: error ? error.message : null }
        },
      },
    ],
  })
  if (!res.ok) return { success: false, error: res.error, wrote: res.wrote }
  return { success: true, wrote: true }
}
