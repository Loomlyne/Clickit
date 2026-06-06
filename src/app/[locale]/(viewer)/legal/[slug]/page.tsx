import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { getLegalPageBySlug, getAllLegalPages } from '@/lib/queries'
import { getLocale, pickLocalized } from '@/lib/locale'
import { LegalPageContent } from '@/components/legal/legal-page-content'

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
  const [page, locale] = await Promise.all([getLegalPageBySlug(slug), getLocale()])

  if (!page) notFound()

  const title = pickLocalized(locale, page.title, page.title_ar)
  const content = pickLocalized(locale, page.content, page.content_ar)

  return (
    <main className="mx-auto max-w-[860px] px-4 py-24 sm:px-6 md:px-10">
      <h1 className="mb-12 font-[family-name:var(--font-display)] text-[clamp(36px,5vw,64px)] leading-none font-normal tracking-[-0.02em]">
        {title}
      </h1>
      <LegalPageContent content={content} updatedAt={page.updated_at} />
    </main>
  )
}
