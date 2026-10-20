import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { getLegalPageBySlug, getAllLegalPages } from '@/lib/queries'
import { pickLocalized } from '@/lib/locale'
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
  return { title: pickLocalized(locale, page.title, page.title_ar) }
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

  const title = pickLocalized(locale, page.title, page.title_ar)
  const content = pickLocalized(locale, page.content, page.content_ar)

  return (
    <LegalDocument eyebrow={tLegal('eyebrow')} title={title}>
      <LegalPageContent content={content} updatedAt={page.updated_at} />
    </LegalDocument>
  )
}
