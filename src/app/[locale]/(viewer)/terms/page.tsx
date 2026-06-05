import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { Link } from '@/i18n/navigation'
import { getLegalPageBySlug } from '@/lib/queries'
import { LegalPageContent } from '@/components/legal/legal-page-content'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('legal')
  return {
    title: t('termsMetaTitle'),
    description: t('termsMetaDescription'),
  }
}

export default async function TermsPage() {
  const [page, t] = await Promise.all([
    getLegalPageBySlug('terms-of-use'),
    getTranslations('legal'),
  ])

  // If admin has entered content for this slug, render it directly.
  if (page?.content?.trim()) {
    return (
      <main className="mx-auto max-w-[860px] px-4 py-24 sm:px-6 md:px-10">
        <div className="mono mb-4 text-[var(--text-mute)]">{t('eyebrow')}</div>
        <h1 className="mb-12 font-[family-name:var(--font-display)] text-[clamp(36px,5vw,64px)] leading-none font-normal tracking-[-0.02em]">
          {page.title}
        </h1>
        <LegalPageContent content={page.content} updatedAt={page.updated_at} />
      </main>
    )
  }

  // Fall back to the built-in i18n terms page.
  return (
    <main className="mx-auto max-w-[860px] px-4 py-24 sm:px-6 md:px-10">
      <div className="mono mb-4 text-[var(--text-mute)]">{t('eyebrow')}</div>
      <h1 className="mb-12 font-[family-name:var(--font-display)] text-[clamp(36px,5vw,64px)] leading-none font-normal tracking-[-0.02em]">
        {t('termsTitle')}
      </h1>
      <div className="prose prose-invert max-w-none space-y-8 text-[15px] leading-relaxed text-[var(--text-dim)]">
        <section>
          <h2 className="mb-3 font-[family-name:var(--font-display)] text-[22px] font-normal text-[var(--text)]">
            {t('terms1Heading')}
          </h2>
          <p>{t('terms1Body')}</p>
        </section>
        <section>
          <h2 className="mb-3 font-[family-name:var(--font-display)] text-[22px] font-normal text-[var(--text)]">
            {t('terms2Heading')}
          </h2>
          <p>{t('terms2Body')}</p>
        </section>
        <section>
          <h2 className="mb-3 font-[family-name:var(--font-display)] text-[22px] font-normal text-[var(--text)]">
            {t('terms3Heading')}
          </h2>
          <p>{t('terms3Body')}</p>
        </section>
        <section>
          <h2 className="mb-3 font-[family-name:var(--font-display)] text-[22px] font-normal text-[var(--text)]">
            {t('terms4Heading')}
          </h2>
          <p>{t('terms4Body')}</p>
        </section>
        <section>
          <h2 className="mb-3 font-[family-name:var(--font-display)] text-[22px] font-normal text-[var(--text)]">
            {t('terms5Heading')}
          </h2>
          <p>{t('terms5Body')}</p>
        </section>
        <section>
          <h2 className="mb-3 font-[family-name:var(--font-display)] text-[22px] font-normal text-[var(--text)]">
            {t('terms6Heading')}
          </h2>
          <p>
            {t('terms6BodyBefore')}
            <Link
              href="/support"
              className="text-[var(--primary)] hover:underline"
            >
              {t('terms6LinkLabel')}
            </Link>
            {t('terms6BodyAfter')}
          </p>
        </section>
        <p className="mono border-t border-[var(--line)] pt-8 text-[11px] text-[var(--text-mute)]">
          {t('lastUpdated')}
        </p>
      </div>
    </main>
  )
}
