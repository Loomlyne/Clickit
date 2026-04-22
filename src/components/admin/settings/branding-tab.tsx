'use client'

import { useLocale } from 'next-intl'
import type { AppConfig } from '@/lib/config'
import { HeroVideoManager } from '@/components/admin/hero-video-manager'
import { SettingsCard } from './settings-card'
import { ImageUploadField } from './image-upload-field'
import { GenreColorEditor } from './genre-color-editor'

export function BrandingTab({ config }: { config: AppConfig }) {
  const locale = useLocale()
  const isArabic = locale === 'ar'
  const currentVideo =
    config.heroVideoUrl && config.heroVideoType
      ? { url: config.heroVideoUrl, type: config.heroVideoType }
      : null

  return (
    <>
      <SettingsCard
        title={isArabic ? 'فيديو الهيرو' : 'Hero video'}
        description={isArabic
          ? 'ارفع ملف MP4 أو الصق رابط يوتيوب. يعمل بدون صوت كخلفية هيرو الصفحة الرئيسية.'
          : 'Upload an MP4 or paste a YouTube URL. Plays muted as the landing-page hero background.'}
      >
        <HeroVideoManager currentVideo={currentVideo} />
      </SettingsCard>

      <SettingsCard
        title={isArabic ? 'صورة Open Graph' : 'Open Graph image'}
        description={isArabic
          ? 'الصورة المعروضة عند مشاركة الموقع على وسائل التواصل (واتساب، X، سلاك، لينكدإن). الموصى به 1200×630.'
          : 'The preview image shown when the site is shared on social media (WhatsApp, X, Slack, LinkedIn). Recommended 1200×630.'}
      >
        <ImageUploadField
          kind="og"
          currentUrl={config.ogImageUrl}
          accept="image/png,image/jpeg,image/webp"
          maxMb={5}
          previewClassName="aspect-[1200/630] w-full max-w-sm"
          hint={isArabic ? 'PNG أو JPG أو WebP. الحد 5 م.ب.' : 'PNG, JPG, or WebP. Max 5MB.'}
        />
      </SettingsCard>

      <SettingsCard
        title={isArabic ? 'أيقونة المتصفح' : 'Favicon'}
        description={isArabic
          ? 'الأيقونة الصغيرة المعروضة في علامات تبويب المتصفح والإشارات المرجعية.'
          : 'The tiny icon shown in browser tabs and bookmarks.'}
      >
        <ImageUploadField
          kind="favicon"
          currentUrl={config.faviconUrl}
          accept="image/png,image/x-icon,image/svg+xml"
          maxMb={1}
          previewClassName="size-24"
          hint={isArabic ? 'PNG أو ICO أو SVG. الحد 1 م.ب. استخدم صورة مربّعة.' : 'PNG, ICO, or SVG. Max 1MB. Use a square image.'}
        />
      </SettingsCard>

      <GenreColorEditor initial={config.genreConfig} />
    </>
  )
}
