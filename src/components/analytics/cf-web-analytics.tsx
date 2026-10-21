import Script from 'next/script'

import { beaconAttributes } from '@/lib/web-analytics'

/** Cloudflare Web Analytics beacon. Renders nothing without a valid token. */
export function CfWebAnalytics({ token }: { token: string | undefined }) {
  const attrs = beaconAttributes(token)
  if (!attrs) return null
  return <Script strategy="afterInteractive" defer src={attrs.src} data-cf-beacon={attrs['data-cf-beacon']} />
}
