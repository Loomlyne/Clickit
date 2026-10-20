import {
  AdminPanel,
  AdminTableShell,
  adminPanelClass,
} from '@/components/admin/admin-shell'
import { cn } from '@/lib/utils'

export default function ShowDetailLoading() {
  return (
    <div className="space-y-6">
      {/* Back link */}
      <div className="h-4 w-28 animate-pulse rounded bg-[var(--bg-3)]" />

      {/* Show header panel */}
      <AdminPanel className="p-0">
        <div className="flex flex-col gap-4 p-6 md:flex-row md:items-start md:p-8">
          {/* Poster thumbnail */}
          <div className="aspect-video w-full animate-pulse rounded-lg bg-[var(--bg-3)] md:w-[240px] md:shrink-0" />
          <div className="flex-1 space-y-3">
            <div className="h-3 w-20 animate-pulse rounded-full bg-[var(--bg-3)]" />
            <div className="h-8 w-2/3 animate-pulse rounded-xl bg-[var(--bg-3)]" />
            <div className="h-4 w-full animate-pulse rounded-lg bg-[var(--bg-3)]" />
            <div className="h-4 w-4/5 animate-pulse rounded-lg bg-[var(--bg-3)]" />
            <div className="mt-2 flex gap-2">
              <div className="h-7 w-20 animate-pulse rounded-full bg-[var(--bg-3)]" />
              <div className="h-7 w-24 animate-pulse rounded-full bg-[var(--bg-3)]" />
            </div>
            <div className="flex gap-2 pt-2">
              <div className="h-9 w-28 animate-pulse rounded-lg bg-[var(--bg-3)]" />
              <div className="h-9 w-24 animate-pulse rounded-lg bg-[var(--bg-3)]" />
            </div>
          </div>
        </div>
      </AdminPanel>

      {/* Season tabs */}
      <div className="flex gap-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="h-9 w-24 animate-pulse rounded-lg bg-[var(--bg-3)]"
          />
        ))}
      </div>

      {/* Episodes table */}
      <AdminTableShell>
        <div className="h-12 animate-pulse border-b border-[var(--line)] bg-[var(--bg-2)]" />
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-4 border-b border-[var(--line)] px-4 py-3"
          >
            <div className="h-4 w-8 animate-pulse rounded bg-[var(--bg-3)]" />
            <div className="aspect-video w-20 animate-pulse rounded bg-[var(--bg-3)]" />
            <div className="flex-1 space-y-1.5">
              <div className="h-4 w-1/2 animate-pulse rounded bg-[var(--bg-3)]" />
              <div className="h-3 w-3/4 animate-pulse rounded bg-[var(--bg-2)]" />
            </div>
            <div className="h-6 w-16 animate-pulse rounded-full bg-[var(--bg-3)]" />
            <div className="h-8 w-8 animate-pulse rounded bg-[var(--bg-3)]" />
          </div>
        ))}
      </AdminTableShell>

      {/* Cast section */}
      <AdminPanel>
        <div className="mb-4 h-5 w-16 animate-pulse rounded-lg bg-[var(--bg-3)]" />
        <div className="flex gap-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex flex-col items-center gap-2">
              <div className="h-14 w-14 animate-pulse rounded-full bg-[var(--bg-3)]" />
              <div className="h-3 w-12 animate-pulse rounded bg-[var(--bg-2)]" />
            </div>
          ))}
        </div>
      </AdminPanel>
    </div>
  )
}
