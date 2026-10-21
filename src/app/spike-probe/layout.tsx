import type { Metadata } from 'next'

/**
 * Phase 02.1 spike probe pages (plan 02.1-01, THROWAWAY: deleted in plan
 * 02.1-06). Unlinked, noindex, never shown to viewers. The root layout
 * renders no <html>/<body>, so this layout supplies its own. Fixed probe
 * labels only (not translated).
 */
export const metadata: Metadata = { robots: { index: false, follow: false } }

export default function SpikeProbeLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" dir="ltr">
      <body>{children}</body>
    </html>
  )
}
