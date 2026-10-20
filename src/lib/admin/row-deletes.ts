// Single-row deletes for legal pages, FAQs, reviews and shorts: the row is read
// first so the audit keeps a snapshot, then pending audit row -> delete -> terminal row.
// No next/*, server-only or '@/' imports: node --test loads this file.
import { runAuditedDelete } from './compensation.ts'
import { parseId } from './schemas.ts'
import type { AdminDb, AuditWriter, CoreResult } from './ports'

type Entity = Parameters<AuditWriter>[0]['entity']

export type RowDeleteSpec = {
  table: 'legal_pages' | 'faqs' | 'reviews' | 'shorts'
  entity: Entity
  label: string
  /** Columns kept in the audit snapshot. */
  columns: string
}

export const ROW_DELETE: Record<'legalPage' | 'faq' | 'review' | 'short', RowDeleteSpec> = {
  legalPage: { table: 'legal_pages', entity: 'legal_page', label: 'legal page', columns: 'id, slug, title, title_ar' },
  faq: { table: 'faqs', entity: 'faq', label: 'FAQ', columns: 'id, question, question_ar, sort_order' },
  review: {
    table: 'reviews',
    entity: 'review',
    label: 'review',
    columns: 'id, show_id, user_id, stars, body, created_at',
  },
  short: {
    table: 'shorts',
    entity: 'short',
    label: 'short',
    columns: 'id, title, youtube_video_id, channel_name, is_featured, archived',
  },
}

type Deps = { audit: AuditWriter; adminUserId: string }
type Obj = Record<string, unknown>

export async function deleteRowAuditedCore(
  db: AdminDb,
  deps: Deps,
  spec: RowDeleteSpec,
  id: unknown
): Promise<CoreResult<{ snapshot: Obj }>> {
  const pid = parseId(id, spec.label)
  if (!pid.ok) return { success: false, error: pid.error, wrote: false }
  const rowId = pid.value

  const cur = await db.from(spec.table).select(spec.columns).eq('id', rowId).maybeSingle()
  if (cur.error) return { success: false, error: cur.error.message, wrote: false }
  if (!cur.data) {
    const name = spec.label.charAt(0).toUpperCase() + spec.label.slice(1)
    return { success: false, error: `${name} not found.`, wrote: false }
  }
  const snapshot = { ...(cur.data as unknown as Obj) }

  // A review snapshot names its show, so the audit row reads on its own.
  if (spec.table === 'reviews' && typeof snapshot.show_id === 'string') {
    const show = await db.from('shows').select('title').eq('id', snapshot.show_id).maybeSingle()
    if (show.error) return { success: false, error: show.error.message, wrote: false }
    snapshot.show_title = (show.data as { title?: string } | null)?.title ?? null
  }

  const res = await runAuditedDelete({
    audit: deps.audit,
    adminUserId: deps.adminUserId,
    action: 'delete',
    entity: spec.entity,
    entityId: rowId,
    context: { snapshot },
    steps: [
      {
        name: `delete-${spec.entity}`,
        run: async () => {
          const r = await db.from(spec.table).delete().eq('id', rowId).select('id')
          if (r.error) return { error: r.error.message }
          const n = Array.isArray(r.data) ? r.data.length : 0
          return n === 1 ? { error: null } : { error: `delete ${spec.label}: expected 1 row, changed ${n}.` }
        },
      },
    ],
  })
  if (!res.ok) return { success: false, error: res.error, wrote: res.wrote, data: { snapshot } }
  return { success: true, wrote: true, data: { snapshot } }
}
