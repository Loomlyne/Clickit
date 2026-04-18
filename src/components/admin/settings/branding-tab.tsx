'use client'

import type { AppConfig } from '@/lib/config'
import { HeroVideoManager } from '@/components/admin/hero-video-manager'
import { SettingsCard } from './settings-card'
import { ImageUploadField } from './image-upload-field'
import { GenreColorEditor } from './genre-color-editor'

export function BrandingTab({ config }: { config: AppConfig }) {
  const currentVideo =
    config.heroVideoUrl && config.heroVideoType
      ? { url: config.heroVideoUrl, type: config.heroVideoType }
      : null

  return (
    <>
      <SettingsCard
        title="Hero video"
        description="Upload an MP4 or paste a YouTube URL. Plays muted as the landing-page hero background."
      >
        <HeroVideoManager currentVideo={currentVideo} />
      </SettingsCard>

      <SettingsCard
        title="Open Graph image"
        description="The preview image shown when the site is shared on social media (WhatsApp, X, Slack, LinkedIn). Recommended 1200×630."
      >
        <ImageUploadField
          kind="og"
          currentUrl={config.ogImageUrl}
          accept="image/png,image/jpeg,image/webp"
          maxMb={5}
          previewClassName="aspect-[1200/630] w-full max-w-sm"
          hint="PNG, JPG, or WebP. Max 5MB."
        />
      </SettingsCard>

      <SettingsCard
        title="Favicon"
        description="The tiny icon shown in browser tabs and bookmarks."
      >
        <ImageUploadField
          kind="favicon"
          currentUrl={config.faviconUrl}
          accept="image/png,image/x-icon,image/svg+xml"
          maxMb={1}
          previewClassName="size-24"
          hint="PNG, ICO, or SVG. Max 1MB. Use a square image."
        />
      </SettingsCard>

      <GenreColorEditor initial={config.genreConfig} />
    </>
  )
}
