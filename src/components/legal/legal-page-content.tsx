import { getTranslations } from 'next-intl/server'
import { getLocale } from '@/lib/locale-server'
import { LegalUpdated } from '@/components/info/legal-document'

/**
 * Renders admin-authored plain-text legal content.
 * Blank lines become paragraph breaks; single newlines become line breaks.
 */
export async function LegalPageContent({
  content,
  updatedAt,
}: {
  content: string
  updatedAt?: string
}) {
  const [t, locale] = await Promise.all([
    getTranslations('legal'),
    getLocale(),
  ])
  const paragraphs = content
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)

  return (
    <div className="space-y-6">
      {paragraphs.map((para, i) => (
        <p key={i} style={{ whiteSpace: 'pre-wrap' }}>
          {para}
        </p>
      ))}
      {updatedAt && (
        <LegalUpdated>
          {t('lastUpdatedLabel')}{' '}
          {new Date(updatedAt).toLocaleDateString(
            locale === 'ar' ? 'ar-AE' : 'en-US',
            { day: 'numeric', month: 'long', year: 'numeric' }
          )}
        </LegalUpdated>
      )}
    </div>
  )
}
