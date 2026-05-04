import type { Metadata } from 'next'
import { getLocale, getTranslations } from 'next-intl/server'

import {
  AdminPageHeader,
  AdminPanel,
  AdminTableShell,
} from '@/components/admin/admin-shell'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { createAdminClient } from '@/lib/supabase/admin'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('admin.audit')
  return { title: `${t('pageTitle')} | Clickit Admin` }
}

// Revalidation is cheap (admin-only page, low traffic). Force a fresh read
// each request so newly-written audit rows appear immediately.
export const dynamic = 'force-dynamic'

interface AuditRow {
  id: string
  admin_user_id: string
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
  create: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20',
  update: 'bg-sky-500/10 text-sky-300 border-sky-500/20',
  archive: 'bg-amber-500/10 text-amber-300 border-amber-500/20',
  restore: 'bg-purple-500/10 text-purple-300 border-purple-500/20',
  delete: 'bg-rose-500/10 text-rose-300 border-rose-500/20',
  config_update: 'bg-indigo-500/10 text-indigo-300 border-indigo-500/20',
  upload: 'bg-cyan-500/10 text-cyan-300 border-cyan-500/20',
  remove_media: 'bg-orange-500/10 text-orange-300 border-orange-500/20',
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
  const { data: rows, error } = await admin
    .from('admin_audit_log')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(200)

  const typedRows = (rows ?? []) as AuditRow[]

  return (
    <div className="space-y-6">
      <AdminPageHeader title={t('heading')} description={t('description')} />

      {error && (
        <AdminPanel className="border-rose-500/20 bg-rose-500/10 p-4 text-sm text-rose-200">
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
                <TableHead>{t('actionColumn')}</TableHead>
                <TableHead>{t('entityColumn')}</TableHead>
                <TableHead>{t('detailsColumn')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {typedRows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="text-white/64" title={row.created_at}>
                    {formatRelative(row.created_at, isArabic)}
                  </TableCell>
                  <TableCell>
                    <span
                      className={`inline-flex rounded-[14px] border px-2 py-0.5 text-xs font-medium ${
                        ACTION_STYLES[row.action_type] ??
                        'border-white/8 bg-white/5 text-white/70'
                      }`}
                    >
                      {row.action_type}
                    </span>
                  </TableCell>
                  <TableCell className="text-white/80">
                    {row.entity_type}
                    {row.entity_id && (
                      <span className="ms-2 font-mono text-[10px] text-white/40">
                        {row.entity_id.slice(0, 8)}...
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="max-w-xl font-mono text-[11px] text-white/56">
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
