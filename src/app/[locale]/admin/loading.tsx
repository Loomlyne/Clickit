import { AdminPanel, AdminTableShell } from '@/components/admin/admin-shell'

/**
 * Reserves hero + table chrome height while RSC data loads — cuts CLS on
 * inbox, categories, settings, and other admin list pages.
 */
export default function AdminLoading() {
  return (
    <div className="space-y-8">
      <AdminPanel className="p-0">
        <div className="h-[88px] animate-pulse rounded-lg bg-white/5 p-6 md:h-[92px]" />
      </AdminPanel>
      <AdminTableShell className="overflow-hidden rounded-lg border-white/8">
        <div className="space-y-0">
          <div className="h-12 animate-pulse border-b border-white/8 bg-white/5" />
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="h-14 animate-pulse border-b border-white/8 bg-white/[0.02]"
            />
          ))}
        </div>
      </AdminTableShell>
    </div>
  )
}
