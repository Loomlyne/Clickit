import type { AppConfig } from '@/lib/config'
import { SiteMetadataEditor } from './site-metadata-editor'
import { LiveStreamUrlEditor } from './live-stream-url-editor'
import { TopTickerEditor } from './top-ticker-editor'

export function GeneralTab({ config }: { config: AppConfig }) {
  return (
    <>
      <SiteMetadataEditor
        initial={{
          site_title: config.siteTitle,
          site_description: config.siteDescription ?? '',
          site_description_ar: config.siteDescriptionAr ?? '',
          site_tagline: config.siteTagline,
          site_tagline_ar: config.siteTaglineAr ?? '',
        }}
      />
      <LiveStreamUrlEditor
        initialUrl={config.liveStreamUrl}
        initialLabel={config.liveStreamLabel}
        initialLabelAr={config.liveStreamLabelAr}
      />
      <TopTickerEditor initial={config.topTicker} />
    </>
  )
}
