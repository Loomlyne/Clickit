import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { Link } from '@/i18n/navigation'
import { getLegalPageBySlug } from '@/lib/queries'
import { legalPageForLocale } from '@/lib/legal-arabic'
import { getLocale } from '@/lib/locale-server'
import { LegalPageContent } from '@/components/legal/legal-page-content'
import {
  LegalDocument,
  LegalSection,
  LegalUpdated,
  legalLinkClass,
} from '@/components/info/legal-document'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('legal')
  return {
    title: t('privacyMetaTitle'),
    description: t('privacyMetaDescription'),
  }
}

export default async function PrivacyPage() {
  const [page, t, locale] = await Promise.all([
    getLegalPageBySlug('privacy-policy'),
    getTranslations('legal'),
    getLocale(),
  ])

  // Arabic only after an admin ticked "Arabic reviewed"; otherwise the English legal text.
  const { title, content } = page ? legalPageForLocale(page, locale) : { title: '', content: '' }

  // If admin has entered content for this slug + locale, render it directly.
  if (content.trim()) {
    return (
      <LegalDocument eyebrow={t('eyebrow')} title={title}>
        <LegalPageContent content={content} updatedAt={page!.updated_at} />
      </LegalDocument>
    )
  }

  // Fall back to the built-in i18n privacy page.
  return (
    <LegalDocument eyebrow={t('eyebrow')} title={t('privacyTitle')}>
      <LegalSection heading={t('privacy1Heading')}>
        {t('privacy1Body')}
      </LegalSection>
      <LegalSection heading={t('privacy2Heading')}>
        {t('privacy2Body')}
      </LegalSection>
      <LegalSection heading={t('privacy3Heading')}>
        {t('privacy3BodyBefore')}
        <a
          href="https://policies.google.com/privacy"
          target="_blank"
          rel="noreferrer"
          className={legalLinkClass}
        >
          {t('privacy3LinkLabel')}
        </a>
        {t('privacy3BodyAfter')}
      </LegalSection>
      <LegalSection heading={t('privacy4Heading')}>
        {t('privacy4Body')}
      </LegalSection>
      <LegalSection heading={t('privacy5Heading')}>
        {t('privacy5BodyBefore')}
        <Link href="/support" className={legalLinkClass}>
          {t('privacy5LinkLabel')}
        </Link>
        {t('privacy5BodyAfter')}
      </LegalSection>
      <LegalSection heading={t('privacy6Heading')}>
        {t('privacy6Body')}
      </LegalSection>
      <LegalUpdated>{t('lastUpdated')}</LegalUpdated>
    </LegalDocument>
  )
}
