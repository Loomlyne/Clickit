import { createClient } from '@/lib/supabase/server'
import { getAppConfig } from '@/lib/config'
import { Navbar } from '@/components/layout/navbar'
import { Footer } from '@/components/layout/footer'
import { SmoothScroll } from '@/components/providers/smooth-scroll'
import { ViewerScrollPersistence } from '@/components/providers/viewer-scroll-persistence'
import { MarqueeTicker } from '@/components/landing/marquee-ticker'
import { EntryPreload } from '@/components/layout/entry-preload'

export default async function ViewerLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // getClaims() verifies the JWT locally (ES256 JWKS, cached) instead of calling
  // the Supabase auth server. It still validates the signature; initialUser is
  // only a flash-prevention hint — AuthSection re-derives the full session on
  // the client. Saves an auth-server roundtrip on every hard page load.
  const supabase = await createClient()
  const [authResult, config] = await Promise.all([
    supabase.auth.getClaims(),
    getAppConfig(),
  ])
  const claims = authResult.data?.claims
  const user = claims ? { id: claims.sub, email: claims.email ?? '' } : null

  return (
    <>
      {/* Server-rendered black cover — paints instantly before JS, prevents content flash */}
      <div
        id="preload-cover"
        aria-hidden="true"
        style={{ position: 'fixed', inset: 0, background: '#0a0a0a', zIndex: 997 }}
      />
      <EntryPreload />
      <SmoothScroll>
        <ViewerScrollPersistence />
        <div className="relative min-h-screen bg-black">
          <MarqueeTicker ticker={config.topTicker} />
          <Navbar
            initialUser={user}
            liveStreamUrl={config.liveStreamUrl}
            logoUrl={config.faviconUrl}
          />
          <div className="pt-16">
            {children}
          </div>
        </div>
        <Footer />
      </SmoothScroll>
    </>
  )
}
