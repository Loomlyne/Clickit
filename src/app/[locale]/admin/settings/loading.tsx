import { AdminPageHeader, AdminPanel } from '@/components/admin/admin-shell'

export default function SettingsLoading() {
  return (
    <div className="space-y-6">
      {/* Page header */}
      <AdminPanel className="p-6 md:p-8">
        <div className="h-3 w-24 animate-pulse rounded-full bg-white/[0.06]" />
        <div className="mt-2 h-8 w-40 animate-pulse rounded-xl bg-white/[0.09]" />
        <div className="mt-2 h-4 w-80 animate-pulse rounded-lg bg-white/[0.06]" />
      </AdminPanel>

      {/* Tabs bar */}
      <div className="flex gap-1 rounded-lg border border-white/[0.06] bg-white/[0.02] p-1">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="h-9 flex-1 animate-pulse rounded-md bg-white/[0.05]"
          />
        ))}
      </div>

      {/* Settings form panel */}
      <AdminPanel className="space-y-5 p-6 md:p-8">
        {/* Section heading */}
        <div className="h-5 w-40 animate-pulse rounded-lg bg-white/[0.08]" />
        <div className="h-px w-full animate-pulse bg-white/[0.06]" />

        {/* Form rows */}
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="space-y-1">
              <div className="h-4 w-36 animate-pulse rounded bg-white/[0.07]" />
              <div className="h-3 w-56 animate-pulse rounded bg-white/[0.05]" />
            </div>
            <div className="h-11 w-full animate-pulse rounded-lg bg-white/[0.06] sm:w-64" />
          </div>
        ))}

        {/* Save button */}
        <div className="flex justify-end pt-2">
          <div className="h-11 w-32 animate-pulse rounded-lg bg-white/[0.10]" />
        </div>
      </AdminPanel>
    </div>
  )
}
