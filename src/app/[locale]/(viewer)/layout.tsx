import { createClient } from '@/lib/supabase/server'
import { getAppConfig } from '@/lib/config'
import { pickLocalized } from '@/lib/locale'
import { getLocale } from '@/lib/locale-server'
import { ViewerShell } from '@/components/layout/viewer-shell'
import { SmoothScroll } from '@/components/providers/smooth-scroll'
import { ViewerScrollPersistence } from '@/components/providers/viewer-scroll-persistence'
import { EntryPreload } from '@/components/layout/entry-preload'

export default async function ViewerLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const [authResult, config, locale] = await Promise.all([
    supabase.auth.getClaims(),
    getAppConfig(),
    getLocale(),
  ])
  const claims = authResult.data?.claims
  const user = claims ? { id: claims.sub, email: claims.email ?? '' } : null

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
      <div
        id="preload-cover"
        aria-hidden="true"
        style={{ position: 'fixed', inset: 0, background: '#0a0a0a', zIndex: 997 }}
      />
      <EntryPreload videoUrl={config.preloaderVideoUrl} />
      <SmoothScroll>
        <ViewerScrollPersistence />
        <ViewerShell
          comingSoonGate={config.flags.comingSoonMode}
          ticker={localizedTicker}
          initialUser={user}
          liveStreamUrl={config.liveStreamUrl}
          liveStreamLabel={config.liveStreamLabel}
          liveStreamLabelAr={config.liveStreamLabelAr}
          logoUrl={config.faviconUrl}
        >
          {children}
        </ViewerShell>
      </SmoothScroll>
    </>
  )
}
