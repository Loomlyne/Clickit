import { createClient } from '@/lib/supabase/server'
import { Navbar } from '@/components/layout/navbar'
import { Footer } from '@/components/layout/footer'
import { SmoothScroll } from '@/components/providers/smooth-scroll'
import { PageTransition } from '@/components/layout/page-transition'
import { ViewerSilkBackground } from '@/components/layout/viewer-silk-background'
import { EntryPreload } from '@/components/layout/entry-preload'

export default async function ViewerLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Use getSession() instead of getUser() — middleware already validated the JWT
  // and refreshed cookies. This avoids a redundant ~50-100ms server round-trip.
  const supabase = await createClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()
  const user = session?.user ?? null

  return (
    <>
      <EntryPreload />
      <ViewerSilkBackground />
      <SmoothScroll>
        {/* z-[2] wrapper pushes all content above the fixed silk (z-1) */}
        <div className="relative z-[2]">
          <Navbar
            initialUser={user ? { id: user.id, email: user.email ?? '' } : null}
          />
          <div className="pt-16">
            <PageTransition>{children}</PageTransition>
          </div>
        </div>
        {/* Footer sits below z-[2] so silk (z-1) renders above it */}
        <Footer />
      </SmoothScroll>
    </>
  )
}
