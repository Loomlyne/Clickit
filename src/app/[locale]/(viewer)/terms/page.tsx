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
    title: t('termsMetaTitle'),
    description: t('termsMetaDescription'),
  }
}

export default async function TermsPage() {
  const [page, t, locale] = await Promise.all([
    getLegalPageBySlug('terms-of-use'),
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

  // Fall back to the built-in i18n terms page.
  return (
    <LegalDocument eyebrow={t('eyebrow')} title={t('termsTitle')}>
      <LegalSection heading={t('terms1Heading')}>{t('terms1Body')}</LegalSection>
      <LegalSection heading={t('terms2Heading')}>{t('terms2Body')}</LegalSection>
      <LegalSection heading={t('terms3Heading')}>{t('terms3Body')}</LegalSection>
      <LegalSection heading={t('terms4Heading')}>{t('terms4Body')}</LegalSection>
      <LegalSection heading={t('terms5Heading')}>{t('terms5Body')}</LegalSection>
      <LegalSection heading={t('terms6Heading')}>
        {t('terms6BodyBefore')}
        <Link href="/support" className={legalLinkClass}>
          {t('terms6LinkLabel')}
        </Link>
        {t('terms6BodyAfter')}
      </LegalSection>
      <LegalUpdated>{t('lastUpdated')}</LegalUpdated>
    </LegalDocument>
  )
}
