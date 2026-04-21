import type { Metadata } from 'next'

import { createAdminClient } from '@/lib/supabase/admin'

export const metadata: Metadata = {
  title: 'Audit Log | Clickit Admin',
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

function formatRelative(iso: string): string {
  const t = new Date(iso).getTime()
  const now = Date.now()
  const s = Math.round((now - t) / 1000)
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
  const { data: rows, error } = await admin
    .from('admin_audit_log')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(200)

  const typedRows = (rows ?? []) as AuditRow[]

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-2xl font-semibold tracking-[-0.02em] text-white">
          Audit Log
        </h1>
        <p className="mt-1 text-sm text-white/56">
          Last 200 admin actions. Newest first. Rows are immutable — there is no edit or delete.
        </p>
      </header>

      {error && (
        <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 p-4 text-sm text-rose-200">
          Failed to load audit log: {error.message}
        </div>
      )}

      {typedRows.length === 0 && !error && (
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-8 text-center text-sm text-white/56">
          No audit rows yet. Actions taken on this admin from now on will appear here.
        </div>
      )}

      {typedRows.length > 0 && (
        <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">
          <table className="w-full text-sm">
            <thead className="border-b border-white/10 bg-white/[0.02] text-start text-xs uppercase tracking-[0.12em] text-white/48">
              <tr>
                <th className="px-4 py-3 font-medium">When</th>
                <th className="px-4 py-3 font-medium">Action</th>
                <th className="px-4 py-3 font-medium">Entity</th>
                <th className="px-4 py-3 font-medium">Details</th>
              </tr>
            </thead>
            <tbody>
              {typedRows.map((row) => (
                <tr key={row.id} className="border-b border-white/5 last:border-0 hover:bg-white/[0.02]">
                  <td className="px-4 py-3 text-white/64" title={row.created_at}>
                    {formatRelative(row.created_at)}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${
                        ACTION_STYLES[row.action_type] ?? 'bg-white/5 text-white/70 border-white/10'
                      }`}
                    >
                      {row.action_type}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-white/80">
                    {row.entity_type}
                    {row.entity_id && (
                      <span className="ms-2 font-mono text-[10px] text-white/40">
                        {row.entity_id.slice(0, 8)}…
                      </span>
                    )}
                  </td>
                  <td className="max-w-xl px-4 py-3 font-mono text-[11px] text-white/56">
                    <span className="block truncate" title={formatDiff(row.diff)}>
                      {formatDiff(row.diff)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
