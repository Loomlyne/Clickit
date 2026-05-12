'use client'

import { useTranslations } from 'next-intl'
import type { AppConfig } from '@/lib/config'
import { HeroVideoManager } from '@/components/admin/hero-video-manager'
import { SettingsCard } from './settings-card'
import { ImageUploadField } from './image-upload-field'

export function BrandingTab({ config }: { config: AppConfig }) {
  const t = useTranslations('admin.settings')
  const currentVideo =
    config.heroVideoUrl && config.heroVideoType
      ? { url: config.heroVideoUrl, type: config.heroVideoType }
      : null

  return (
    <>
      <SettingsCard
        title={t('heroVideoCardTitle')}
        description={t('heroVideoCardDescription')}
      >
        <HeroVideoManager currentVideo={currentVideo} />
      </SettingsCard>

      <SettingsCard
        title={t('ogImageTitle')}
        description={t('ogImageDescription')}
      >
        <ImageUploadField
          kind="og"
          currentUrl={config.ogImageUrl}
          accept="image/png,image/jpeg,image/webp"
          maxMb={5}
          previewClassName="aspect-[1200/630] w-full max-w-sm"
          hint={t('ogImageHint')}
        />
      </SettingsCard>

      <SettingsCard
        title={t('faviconTitle')}
        description={t('faviconDescription')}
      >
        <ImageUploadField
          kind="favicon"
          currentUrl={config.faviconUrl}
          accept="image/png,image/x-icon,image/svg+xml"
          maxMb={1}
          previewClassName="size-24"
          hint={t('faviconHint')}
        />
      </SettingsCard>
    </>
  )
}
