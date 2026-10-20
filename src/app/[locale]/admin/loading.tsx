import { AdminPanel, AdminTableShell } from '@/components/admin/admin-shell'

/**
 * Reserves hero + table chrome height while RSC data loads — cuts CLS on
 * inbox, categories, settings, and other admin list pages.
 */
export default function AdminLoading() {
  return (
    <div className="space-y-8">
      <AdminPanel className="p-0">
        <div className="h-[88px] animate-pulse rounded-lg bg-[var(--bg-2)] p-6 md:h-[92px]" />
      </AdminPanel>
      <AdminTableShell className="overflow-hidden rounded-lg border-[var(--line)]">
        <div className="space-y-0">
          <div className="h-12 animate-pulse border-b border-[var(--line)] bg-[var(--bg-2)]" />
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="h-14 animate-pulse border-b border-[var(--line)] bg-[var(--bg-2)]"
            />
          ))}
        </div>
      </AdminTableShell>
    </div>
  )
}
