'use client'

import { useTranslations } from 'next-intl'
import { Info, Sun, Moon } from 'lucide-react'
import type { AppConfig } from '@/lib/config'
import { HeroVideoManager } from '@/components/admin/hero-video-manager'
import { SettingsCard } from './settings-card'
import { ImageUploadField } from './image-upload-field'
import { PreloaderVideoField } from './preloader-video-field'

export function BrandingTab({ config }: { config: AppConfig }) {
  const t = useTranslations('admin.settings')
  const desktopVideo =
    config.heroVideoUrl && config.heroVideoType
      ? { url: config.heroVideoUrl, type: config.heroVideoType }
      : null
  const mobileVideo =
    config.heroVideoMobileUrl && config.heroVideoMobileType
      ? { url: config.heroVideoMobileUrl, type: config.heroVideoMobileType }
      : null

  return (
    <>
      <SettingsCard
        title={t('preloaderVideoCardTitle')}
        description={t('preloaderVideoCardDescription')}
      >
        <PreloaderVideoField currentUrl={config.preloaderVideoUrl} />
      </SettingsCard>

      <SettingsCard
        title={t('heroVideoCardTitle')}
        description={t('heroVideoCardDescription')}
      >
        <HeroVideoManager
          desktopVideo={desktopVideo}
          mobileVideo={mobileVideo}
          heroVideoMuted={config.heroVideoMuted}
        />
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
        {/* Why a second favicon — explains the theme auto-switch behavior. */}
        <div className="mb-6 flex gap-3 rounded-lg border border-white/8 bg-white/[0.03] p-4">
          <Info className="mt-0.5 size-4 shrink-0 text-white/50" />
          <p className="text-muted-foreground text-sm leading-relaxed">
            {t('faviconWhy')}
          </p>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          {/* Light-mode variant — previews on a light surface. */}
          <div className="rounded-lg border border-white/8 bg-white/[0.02] p-4">
            <div className="mb-3 flex items-center gap-2">
              <Sun className="size-4 text-amber-300/80" />
              <div>
                <p className="text-sm font-medium text-white">
                  {t('faviconLightLabel')}
                </p>
                <p className="text-muted-foreground text-xs">
                  {t('faviconLightSub')}
                </p>
              </div>
            </div>
            <ImageUploadField
              kind="favicon"
              currentUrl={config.faviconUrl}
              accept="image/png,image/x-icon"
              maxMb={1}
              previewClassName="size-20"
              previewBgClassName="bg-white"
              hint={t('faviconHint')}
            />
          </div>

          {/* Dark-mode variant — previews on a black surface. */}
          <div className="rounded-lg border border-white/8 bg-white/[0.02] p-4">
            <div className="mb-3 flex items-center gap-2">
              <Moon className="size-4 text-sky-300/80" />
              <div>
                <p className="text-sm font-medium text-white">
                  {t('faviconDarkLabel')}
                </p>
                <p className="text-muted-foreground text-xs">
                  {t('faviconDarkSub')}
                </p>
              </div>
            </div>
            <ImageUploadField
              kind="favicon-dark"
              currentUrl={config.faviconDarkUrl}
              accept="image/png,image/x-icon"
              maxMb={1}
              previewClassName="size-20"
              previewBgClassName="bg-black"
              hint={t('faviconDarkFallback')}
            />
          </div>
        </div>
      </SettingsCard>
    </>
  )
}
