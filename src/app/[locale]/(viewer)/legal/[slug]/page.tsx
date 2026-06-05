import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { getLegalPageBySlug, getAllLegalPages } from '@/lib/queries'
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
  const page = await getLegalPageBySlug(slug)
  if (!page) return {}
  return { title: page.title }
}

export default async function LegalPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const page = await getLegalPageBySlug(slug)

  if (!page) notFound()

  return (
    <main className="mx-auto max-w-[860px] px-4 py-24 sm:px-6 md:px-10">
      <h1 className="mb-12 font-[family-name:var(--font-display)] text-[clamp(36px,5vw,64px)] leading-none font-normal tracking-[-0.02em]">
        {page.title}
      </h1>
      <LegalPageContent content={page.content} updatedAt={page.updated_at} />
    </main>
  )
}
