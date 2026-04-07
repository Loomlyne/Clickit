import { createClient } from '@/lib/supabase/server'
import { Navbar } from '@/components/layout/navbar'
import { Footer } from '@/components/layout/footer'

export default async function ViewerLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  return (
    <>
      <Navbar initialUser={user ? { id: user.id, email: user.email ?? '' } : null} />
      <div className="pt-24 md:pt-28">
        {children}
      </div>
      <Footer />
    </>
  )
}
