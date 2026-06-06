import { getLocale } from 'next-intl/server'
import { redirect } from '@/i18n/navigation'
import { createClient } from '@/lib/supabase/server'
import { AdminHeader } from '@/components/admin/admin-header'

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
    <div className="min-h-screen bg-[var(--bg-0)]">
      <AdminHeader />
      <div className="mx-auto max-w-7xl px-4 pt-28 pb-10 md:px-8 md:pt-32 md:pb-16">
        {children}
      </div>
    </div>
  )
}
