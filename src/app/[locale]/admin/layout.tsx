import { getLocale } from 'next-intl/server'
import { redirect } from '@/i18n/navigation'
import { createClient } from '@/lib/supabase/server'
import { AdminHeader } from '@/components/admin/admin-header'
import '@/styles/admin.css'

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    const locale = await getLocale()
    return redirect({ href: '/watch', locale })
  }

  // Check if user is admin via app_config table lookup
  const { data: config } = await supabase
    .from('app_config')
    .select('admin_user_id')
    .eq('id', 1)
    .single()

  if (config?.admin_user_id !== user.id) {
    const locale = await getLocale()
    return redirect({ href: '/watch', locale })
  }

  return (
    <div className="admin-root min-h-screen bg-[var(--bg-0)]">
      <AdminHeader />
      <div className="min-h-0 lg:ps-60">
        <div className="mx-auto max-w-[1180px] px-4 py-6 md:px-8 md:py-8">
          {children}
        </div>
      </div>
    </div>
  )
}
