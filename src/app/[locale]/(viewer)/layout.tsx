import { createClient } from '@/lib/supabase/server'
import { getAppConfig } from '@/lib/config'
import { Navbar } from '@/components/layout/navbar'
import { Footer } from '@/components/layout/footer'
import { SmoothScroll } from '@/components/providers/smooth-scroll'
import { ViewerScrollPersistence } from '@/components/providers/viewer-scroll-persistence'
import { PageTransition } from '@/components/layout/page-transition'
import { ViewerSilkBackground } from '@/components/layout/viewer-silk-background'
import { MarqueeTicker } from '@/components/landing/marquee-ticker'
import { EntryPreload } from '@/components/layout/entry-preload'

export default async function ViewerLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Prefer getUser() in RSC: validates the JWT with Supabase (avoids SSR warning).
  const supabase = await createClient()
  const [authResult, config] = await Promise.all([
    supabase.auth.getUser(),
    getAppConfig(),
  ])
  const {
    data: { user },
  } = authResult

  return (
    <>
      {/* Server-rendered black cover — paints instantly before JS, prevents content flash */}
      <div
        id="preload-cover"
        aria-hidden="true"
        style={{ position: 'fixed', inset: 0, background: '#0a0a0a', zIndex: 997 }}
      />
      <EntryPreload />
      <ViewerSilkBackground />
      <SmoothScroll>
        <ViewerScrollPersistence />
        {/* z-[2] wrapper pushes all content above the fixed silk (z-1) */}
        <div className="relative z-[2]">
          <MarqueeTicker ticker={config.topTicker} />
          <Navbar
            initialUser={user ? { id: user.id, email: user.email ?? '' } : null}
            liveStreamUrl={config.liveStreamUrl}
            logoUrl={config.faviconUrl}
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
