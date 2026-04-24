import { createClient } from '@/lib/supabase/server'
import { Navbar } from '@/components/layout/navbar'
import { Footer } from '@/components/layout/footer'

export default async function ViewerLayout({ children }: { children: React.ReactNode }) {
  // Use getSession() instead of getUser() — middleware already validated the JWT
  // and refreshed cookies. This avoids a redundant ~50-100ms server round-trip.
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  const user = session?.user ?? null

  return (
    <>
      <Navbar
        initialUser={user ? { id: user.id, email: user.email ?? '' } : null}
      />
      <div className="pt-16">
        {children}
      </div>
      <Footer />
    </>
  )
}
