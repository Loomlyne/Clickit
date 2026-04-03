import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { AdminHeader } from '@/components/admin/admin-header'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/')

  // Check if user is admin via app_config table lookup
  const { data: config } = await supabase
    .from('app_config')
    .select('admin_user_id')
    .single()

  if (config?.admin_user_id !== user.id) redirect('/')

  return (
    <div className="min-h-screen bg-background">
      <AdminHeader />
      <div className="mx-auto max-w-7xl px-4 md:px-8 py-8">
        {children}
      </div>
    </div>
  )
}
