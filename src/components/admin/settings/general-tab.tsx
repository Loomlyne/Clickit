'use client'

import type { AppConfig } from '@/lib/config'
import { SiteMetadataEditor } from './site-metadata-editor'
import { LiveStreamUrlEditor } from './live-stream-url-editor'
import { FooterEditor } from './footer-editor'
import { CtaCopyEditor } from './cta-copy-editor'
import { TopTickerEditor } from './top-ticker-editor'

export function GeneralTab({ config }: { config: AppConfig }) {
  return (
    <>
      <SiteMetadataEditor
        initial={{
          site_title: config.siteTitle,
          site_description: config.siteDescription ?? '',
          site_tagline: config.siteTagline,
        }}
      />
      <LiveStreamUrlEditor initialUrl={config.liveStreamUrl} />
      <TopTickerEditor initial={config.topTicker} />
      <FooterEditor initial={config.footer} />
      <CtaCopyEditor initial={config.ctaCopy} />
    </>
  )
}
