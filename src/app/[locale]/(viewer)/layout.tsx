import { createClient } from '@/lib/supabase/server'
import { getAppConfig } from '@/lib/config'
import { getLocale, pickLocalized } from '@/lib/locale'
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
  const [authResult, config, locale] = await Promise.all([
    supabase.auth.getClaims(),
    getAppConfig(),
    getLocale(),
  ])
  const claims = authResult.data?.claims
  const user = claims ? { id: claims.sub, email: claims.email ?? '' } : null

  // Localize the ticker server-side so the client component stays locale-agnostic.
  // Each line shows its Arabic tag/text/tag2 when locale is ar (English fallback).
  const localizedTicker = {
    enabled: config.topTicker.enabled,
    items: config.topTicker.items.map((m) => ({
      tag: pickLocalized(locale, m.tag, m.tag_ar),
      text: pickLocalized(locale, m.text, m.text_ar),
      ...(m.tag2 || m.tag2_ar
        ? { tag2: pickLocalized(locale, m.tag2 ?? '', m.tag2_ar) }
        : {}),
    })),
  }

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
          <MarqueeTicker ticker={localizedTicker} />
          <Navbar
            initialUser={user}
            liveStreamUrl={config.liveStreamUrl}
            liveStreamLabel={config.liveStreamLabel}
            liveStreamLabelAr={config.liveStreamLabelAr}
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
