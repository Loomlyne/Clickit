import { AdminPanel } from '@/components/admin/admin-shell'

export default function ShowEditLoading() {
  return (
    <div className="space-y-6">
      {/* Back link */}
      <div className="h-4 w-28 animate-pulse rounded bg-[var(--bg-3)]" />

      {/* Page header */}
      <AdminPanel className="p-6 md:p-8">
        <div className="h-3 w-24 animate-pulse rounded-full bg-[var(--bg-3)]" />
        <div className="mt-2 h-8 w-48 animate-pulse rounded-xl bg-[var(--bg-3)]" />
        <div className="mt-2 h-4 w-72 animate-pulse rounded-lg bg-[var(--bg-3)]" />
      </AdminPanel>

      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        {/* Left — form */}
        <AdminPanel className="space-y-5 p-6 md:p-8">
          {/* Title + AR title */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <div className="h-3 w-16 animate-pulse rounded bg-[var(--bg-3)]" />
              <div className="h-11 w-full animate-pulse rounded-lg bg-[var(--bg-3)]" />
            </div>
            <div className="space-y-2">
              <div className="h-3 w-20 animate-pulse rounded bg-[var(--bg-3)]" />
              <div className="h-11 w-full animate-pulse rounded-lg bg-[var(--bg-3)]" />
            </div>
          </div>
          {/* Description */}
          <div className="space-y-2">
            <div className="h-3 w-24 animate-pulse rounded bg-[var(--bg-3)]" />
            <div className="h-24 w-full animate-pulse rounded-lg bg-[var(--bg-3)]" />
          </div>
          {/* Genre + status */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <div className="h-3 w-12 animate-pulse rounded bg-[var(--bg-3)]" />
              <div className="h-11 w-full animate-pulse rounded-lg bg-[var(--bg-3)]" />
            </div>
            <div className="space-y-2">
              <div className="h-3 w-14 animate-pulse rounded bg-[var(--bg-3)]" />
              <div className="h-11 w-full animate-pulse rounded-lg bg-[var(--bg-3)]" />
            </div>
          </div>
          {/* URLs */}
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <div className="h-3 w-20 animate-pulse rounded bg-[var(--bg-3)]" />
              <div className="h-11 w-full animate-pulse rounded-lg bg-[var(--bg-3)]" />
            </div>
          ))}
          {/* Submit */}
          <div className="flex gap-3 pt-2">
            <div className="h-11 w-32 animate-pulse rounded-lg bg-[var(--bg-3)]" />
            <div className="h-11 w-24 animate-pulse rounded-lg bg-[var(--bg-3)]" />
          </div>
        </AdminPanel>

        {/* Right — media preview */}
        <div className="space-y-4">
          <AdminPanel className="p-0">
            <div className="aspect-video w-full animate-pulse rounded-lg bg-[var(--bg-3)]" />
            <div className="space-y-3 p-4">
              <div className="h-4 w-32 animate-pulse rounded bg-[var(--bg-3)]" />
              <div className="h-9 w-full animate-pulse rounded-lg bg-[var(--bg-3)]" />
            </div>
          </AdminPanel>
          <AdminPanel className="p-4">
            <div className="mb-3 h-4 w-24 animate-pulse rounded bg-[var(--bg-3)]" />
            <div className="flex gap-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="h-8 w-8 animate-pulse rounded-full bg-[var(--bg-3)]"
                />
              ))}
            </div>
          </AdminPanel>
        </div>
      </div>
    </div>
  )
}
