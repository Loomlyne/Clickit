import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { getLegalPageBySlug, getAllLegalPages } from '@/lib/queries'
import { legalPageForLocale } from '@/lib/legal-arabic'
import { getLocale } from '@/lib/locale-server'
import { getTranslations } from 'next-intl/server'
import { LegalPageContent } from '@/components/legal/legal-page-content'
import { LegalDocument } from '@/components/info/legal-document'

export async function generateStaticParams() {
  const pages = await getAllLegalPages()
  return pages.map((p) => ({ slug: p.slug }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const [page, locale] = await Promise.all([getLegalPageBySlug(slug), getLocale()])
  if (!page) return {}
  return { title: legalPageForLocale(page, locale).title }
}

export default async function LegalPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const [page, locale, tLegal] = await Promise.all([
    getLegalPageBySlug(slug),
    getLocale(),
    getTranslations('legal'),
  ])

  if (!page) notFound()

  // Arabic only after an admin ticked "Arabic reviewed"; otherwise the English legal text.
  const { title, content } = legalPageForLocale(page, locale)

  return (
    <LegalDocument eyebrow={tLegal('eyebrow')} title={title}>
      <LegalPageContent content={content} updatedAt={page.updated_at} />
    </LegalDocument>
  )
}
