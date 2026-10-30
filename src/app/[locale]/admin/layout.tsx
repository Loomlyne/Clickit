import { unstable_rethrow } from 'next/navigation'
import { getLocale } from 'next-intl/server'
import { redirect } from '@/i18n/navigation'
import { AdminAccessError, requireAdmin } from '@/server/auth-guards'
import { AdminHeader } from '@/components/admin/admin-header'
import '@/styles/admin.css'

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // One admin gate (D-17): admins row + fresh TOTP. Not signed in or not an
  // admin -> /watch; an admin who still needs to enrol or enter a code -> /auth/mfa.
  try {
    await requireAdmin()
  } catch (e) {
    // Next's own signals (dynamic-rendering bailout from cookies(), redirect) must
    // pass through: swallowing the bailout made /admin pages prerender at build time.
    unstable_rethrow(e)
    const locale = await getLocale()
    if (e instanceof AdminAccessError && (e.code === 'needs_enrol' || e.code === 'needs_code')) {
      return redirect({ href: { pathname: '/auth/mfa', query: { next: '/admin' } }, locale })
    }
    return redirect({ href: '/watch', locale })
  }

  return (
    <div className="admin-root min-h-screen bg-[var(--bg-0)]">
      <AdminHeader />
      <div className="min-h-0 max-lg:pt-14 lg:ps-60">
        <div className="mx-auto max-w-[1180px] px-4 py-6 md:px-8 md:py-8">
          {children}
        </div>
      </div>
    </div>
  )
}
