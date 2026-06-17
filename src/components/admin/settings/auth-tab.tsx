'use client'

import { useTranslations } from 'next-intl'
import type { AppConfig } from '@/lib/config'
import { SettingsCard } from './settings-card'
import { ImageUploadField } from './image-upload-field'
import { AuthPageEditor } from './auth-page-editor'

export function AuthTab({ config }: { config: AppConfig }) {
  const t = useTranslations('admin.settings')

  return (
    <>
      <SettingsCard
        title={t('authImageTitle')}
        description={t('authImageDescription')}
      >
        <ImageUploadField
          kind="auth"
          currentUrl={config.authImageUrl}
          accept="image/png,image/jpeg,image/webp"
          maxMb={5}
          previewClassName="aspect-[3/4] w-40"
          hint={t('authImageHint')}
        />
      </SettingsCard>

      <AuthPageEditor
        initial={{
          auth_heading: config.authHeading ?? '',
          auth_heading_ar: config.authHeadingAr ?? '',
          auth_subheading: config.authSubheading ?? '',
          auth_subheading_ar: config.authSubheadingAr ?? '',
          auth_quote: config.authQuote ?? '',
          auth_quote_ar: config.authQuoteAr ?? '',
          auth_quote_attribution: config.authQuoteAttribution ?? '',
          auth_quote_attribution_ar: config.authQuoteAttributionAr ?? '',
          auth_google_enabled: config.authGoogleEnabled,
          auth_apple_enabled: config.authAppleEnabled,
        }}
      />
    </>
  )
}
