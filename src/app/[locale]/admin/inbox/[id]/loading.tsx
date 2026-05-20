import { AdminPanel } from '@/components/admin/admin-shell'

export default function InboxMessageLoading() {
  return (
    <div className="space-y-6">
      {/* Back link */}
      <div className="h-4 w-28 animate-pulse rounded bg-white/[0.06]" />

      {/* Message panel */}
      <AdminPanel className="p-0">
        {/* Header */}
        <div className="border-b border-white/[0.06] px-4 py-4 sm:px-6 md:px-8 md:py-6">
          <div className="h-3 w-32 animate-pulse rounded bg-white/[0.05]" />
          <div className="mt-3 h-8 w-2/3 animate-pulse rounded-xl bg-white/[0.09]" />
        </div>

        {/* Meta grid */}
        <div className="grid gap-px border-b border-white/[0.06] bg-white/[0.06] sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="space-y-1 bg-[var(--bg-2)] px-4 py-4 sm:px-6"
            >
              <div className="h-3 w-12 animate-pulse rounded bg-white/[0.05]" />
              <div className="h-4 w-40 animate-pulse rounded bg-white/[0.07]" />
            </div>
          ))}
        </div>

        {/* Message body */}
        <div className="space-y-3 px-4 py-6 sm:px-6 md:px-8">
          <div className="h-4 w-full animate-pulse rounded bg-white/[0.05]" />
          <div className="h-4 w-11/12 animate-pulse rounded bg-white/[0.05]" />
          <div className="h-4 w-5/6 animate-pulse rounded bg-white/[0.05]" />
          <div className="h-4 w-3/4 animate-pulse rounded bg-white/[0.05]" />
        </div>

        {/* Actions */}
        <div className="flex gap-3 border-t border-white/[0.06] px-4 py-4 sm:px-6 md:px-8">
          <div className="h-9 w-28 animate-pulse rounded-lg bg-white/[0.07]" />
          <div className="h-9 w-20 animate-pulse rounded-lg bg-white/[0.06]" />
        </div>
      </AdminPanel>
    </div>
  )
}
