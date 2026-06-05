'use client'

import type { AppConfig } from '@/lib/config'
import { SiteMetadataEditor } from './site-metadata-editor'
import { LiveStreamUrlEditor } from './live-stream-url-editor'
import { FooterEditor } from './footer-editor'
import { TopTickerEditor } from './top-ticker-editor'

export function GeneralTab({ config }: { config: AppConfig }) {
  return (
    <>
      <SiteMetadataEditor
        initial={{
          site_title: config.siteTitle,
          site_description: config.siteDescription ?? '',
          site_tagline: config.siteTagline,
          hero_description: config.heroDescription ?? '',
          hero_description_ar: config.heroDescriptionAr ?? '',
        }}
      />
      <LiveStreamUrlEditor initialUrl={config.liveStreamUrl} />
      <TopTickerEditor initial={config.topTicker} />
      <FooterEditor initial={config.footer} />
    </>
  )
}
