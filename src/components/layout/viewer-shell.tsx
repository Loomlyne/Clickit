'use client'

import { usePathname } from '@/i18n/navigation'
import { Navbar } from '@/components/layout/navbar'
import { MarqueeTicker } from '@/components/landing/marquee-ticker'
import type { TopTickerConfig } from '@/lib/config'

type ViewerShellProps = {
  children: React.ReactNode
  /** Server-rendered footer slot — passed from the RSC layout, not imported here. */
  footer: React.ReactNode
  comingSoonGate: boolean
  ticker: TopTickerConfig
  initialUser?: { id: string; email: string } | null
  liveStreamUrl?: string | null
  liveStreamLabel?: string | null
  liveStreamLabelAr?: string | null
  logoUrl?: string | null
}

function isGateSurface(pathname: string, comingSoonGate: boolean) {
  if (!comingSoonGate) return false
  return pathname === '/coming-soon' || pathname === '/auth'
}

export function ViewerShell({
  children,
  footer,
  comingSoonGate,
  ticker,
  initialUser,
  liveStreamUrl,
  liveStreamLabel,
  liveStreamLabelAr,
  logoUrl,
}: ViewerShellProps) {
  const pathname = usePathname()
  const gateSurface = isGateSurface(pathname, comingSoonGate)

  return (
    <div className="relative min-h-screen bg-black">
      {!gateSurface && <MarqueeTicker ticker={ticker} />}
      <Navbar
        initialUser={initialUser}
        liveStreamUrl={liveStreamUrl}
        liveStreamLabel={liveStreamLabel}
        liveStreamLabelAr={liveStreamLabelAr}
        logoUrl={logoUrl}
        variant={gateSurface ? 'minimal' : 'default'}
      />
      <div className={gateSurface ? undefined : 'pt-16'}>{children}</div>
      {!gateSurface && footer}
    </div>
  )
}
