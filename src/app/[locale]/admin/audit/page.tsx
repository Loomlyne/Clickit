import type { Metadata } from 'next'
import { getLocale, getTranslations } from 'next-intl/server'

import {
  AdminPageHeader,
  AdminPanel,
  AdminTableShell,
} from '@/components/admin/admin-shell'
import { YouTubeStatusChip as StatusChip } from '@/components/admin/youtube-status-chip'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { createAdminClient } from '@/lib/supabase/admin'
import { adminNameMap } from '@/server/admin-directory'
import { auditActorLabel } from '@/server/admin-names'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('admin.audit')
  return { title: `${t('pageTitle')} | Clickit Admin` }
}

// Revalidation is cheap (admin-only page, low traffic). Force a fresh read
// each request so newly-written audit rows appear immediately.
export const dynamic = 'force-dynamic'

interface AuditRow {
  id: string
  admin_user_id: string | null
  action_type: string
  entity_type: string
  entity_id: string | null
  diff: Record<string, unknown> | null
  created_at: string
}

function formatDiff(diff: Record<string, unknown> | null): string {
  if (!diff) return '—'
  try {
    return JSON.stringify(diff)
  } catch {
    return '—'
  }
}

function formatRelative(iso: string, isArabic: boolean): string {
  const t = new Date(iso).getTime()
  const now = Date.now()
  const s = Math.round((now - t) / 1000)
  if (isArabic) {
    if (s < 60) return `قبل ${s} ث`
    if (s < 3600) return `قبل ${Math.round(s / 60)} د`
    if (s < 86400) return `قبل ${Math.round(s / 3600)} س`
    return `قبل ${Math.round(s / 86400)} ي`
  }
  if (s < 60) return `${s}s ago`
  if (s < 3600) return `${Math.round(s / 60)}m ago`
  if (s < 86400) return `${Math.round(s / 3600)}h ago`
  return `${Math.round(s / 86400)}d ago`
}

const ACTION_STYLES: Record<string, string> = {
  create: 'bg-brand-green-safe/12 text-brand-green-safe',
  update: 'bg-brand-blue-safe/12 text-brand-blue-safe',
  archive: 'bg-brand-orange-safe/12 text-brand-orange-safe',
  restore: 'bg-brand-purple-safe/12 text-brand-purple-safe',
  delete: 'bg-brand-red-safe/12 text-brand-red-safe',
  config_update: 'bg-brand-blue-safe/12 text-brand-blue-safe',
  upload: 'bg-brand-green-safe/12 text-brand-green-safe',
  remove_media: 'bg-brand-orange-safe/12 text-brand-orange-safe',
}

// Second column (D-23, AUTH-07): who acted. Name in <bdi> (names can be Arabic
// inside an English page and the reverse); removed admins and system rows in
// --text-mute. The id stays in the row; only the label is looked up.
function AdminCell({
  row,
  names,
  labels,
}: {
  row: AuditRow
  names: ReadonlyMap<string, string> | null
  labels: { former: string; system: string; ownerScript: string }
}) {
  if (names === null) {
    return <span className="text-[var(--text-mute)]">—</span>
  }
  const actor = auditActorLabel(row.admin_user_id, names, row.diff)
  switch (actor.kind) {
    case 'name':
      return <bdi className="text-[var(--text)]">{actor.text}</bdi>
    case 'owner_script':
      return <span className="text-[var(--text)]">{labels.ownerScript}</span>
    case 'former':
      return <span className="text-[var(--text-mute)]">{labels.former}</span>
    case 'system':
      return <span className="text-[var(--text-mute)]">{labels.system}</span>
  }
}

export default async function AuditLogPage() {
  // Use the service-role client — the audit_log RLS policy only grants SELECT
  // to the admin, but the layout has already verified admin before we get here.
  // Reading via admin skips the getUser() round trip on this page.
  const admin = createAdminClient()
  const [t, locale] = await Promise.all([
    getTranslations('admin.audit'),
    getLocale(),
  ])
  const isArabic = locale === 'ar'
  const [{ data: rows, error }, names] = await Promise.all([
    admin
      .from('admin_audit_log')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200),
    // Names from public.admins, read once (D-23). If the lookup fails the
    // column shows a dash rather than calling every admin "Former admin".
    adminNameMap().catch((e: unknown) => {
      console.error('[admin/audit] admin names failed', e)
      return null
    }),
  ])

  const typedRows = (rows ?? []) as AuditRow[]

  return (
    <div className="space-y-5">
      <AdminPageHeader title={t('heading')} description={t('description')} />

      {error && (
        <AdminPanel className="border-brand-red-safe/20 bg-brand-red-safe/10 text-brand-red-safe p-4 text-sm">
          {t('errorHeading')}: {error.message}
        </AdminPanel>
      )}

      {typedRows.length === 0 && !error && (
        <AdminPanel className="text-muted-foreground p-8 text-center text-sm">
          {t('emptyDescription')}
        </AdminPanel>
      )}

      {typedRows.length > 0 && (
        <AdminTableShell>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('whenColumn')}</TableHead>
                <TableHead>{t('adminColumn')}</TableHead>
                <TableHead>{t('actionColumn')}</TableHead>
                <TableHead>{t('entityColumn')}</TableHead>
                <TableHead className="hidden md:table-cell">
                  {t('detailsColumn')}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {typedRows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell
                    className="text-[var(--text-dim)]"
                    title={row.created_at}
                  >
                    {formatRelative(row.created_at, isArabic)}
                  </TableCell>
                  <TableCell className="text-[14px]">
                    <AdminCell
                      row={row}
                      names={names}
                      labels={{
                        former: t('formerAdmin'),
                        system: t('system'),
                        ownerScript: t('actorOwnerScript'),
                      }}
                    />
                  </TableCell>
                  <TableCell>
                    {row.entity_type === 'admin_auth' ? (
                      <StatusChip
                        tone={
                          row.action_type === 'mfa_failed' ? 'bad' : 'neutral'
                        }
                      >
                        {row.action_type}
                      </StatusChip>
                    ) : (
                      <span
                        className={`inline-flex rounded-full px-2.5 py-0.5 text-[12px] font-medium ${
                          ACTION_STYLES[row.action_type] ??
                          'bg-[var(--bg-3)] text-[var(--text-dim)]'
                        }`}
                      >
                        {row.action_type}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-[var(--text-dim)]">
                    {row.entity_type}
                    {row.entity_id && (
                      <span className="ms-2 font-mono text-[12px] text-[var(--text-mute)]">
                        {row.entity_id.slice(0, 8)}...
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="hidden max-w-xl font-mono text-[12px] text-[var(--text-dim)] md:table-cell">
                    <span
                      className="block truncate"
                      title={formatDiff(row.diff)}
                    >
                      {formatDiff(row.diff)}
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </AdminTableShell>
      )}
    </div>
  )
}
