import { createClient } from '@/lib/supabase/server'
import { Navbar } from '@/components/layout/navbar'
import { Footer } from '@/components/layout/footer'
import { getLocale } from '@/lib/locale'

export default async function ViewerLayout({ children }: { children: React.ReactNode }) {
  // Use getSession() instead of getUser() — middleware already validated the JWT
  // and refreshed cookies. This avoids a redundant ~50-100ms server round-trip.
  const supabase = await createClient()
  const [{ data: { session } }, locale] = await Promise.all([
    supabase.auth.getSession(),
    getLocale(),
  ])
  const user = session?.user ?? null

  return (
    <>
      <Navbar
        initialUser={user ? { id: user.id, email: user.email ?? '' } : null}
        locale={locale}
      />
      <div className="pt-24 md:pt-28">
        {children}
      </div>
      <Footer />
    </>
  )
}
