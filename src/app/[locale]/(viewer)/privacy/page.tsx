import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { Link } from '@/i18n/navigation'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('legal')
  return {
    title: t('privacyMetaTitle'),
    description: t('privacyMetaDescription'),
  }
}

export default async function PrivacyPage() {
  const t = await getTranslations('legal')
  return (
    <main className="mx-auto max-w-[860px] px-4 py-24 sm:px-6 md:px-10">
      <div className="mono mb-4 text-[var(--text-mute)]">{t('eyebrow')}</div>
      <h1 className="mb-12 font-[family-name:var(--font-display)] text-[clamp(36px,5vw,64px)] leading-none font-normal tracking-[-0.02em]">
        {t('privacyTitle')}
      </h1>
      <div className="prose prose-invert max-w-none space-y-8 text-[15px] leading-relaxed text-[var(--text-dim)]">
        <section>
          <h2 className="mb-3 font-[family-name:var(--font-display)] text-[22px] font-normal text-[var(--text)]">
            {t('privacy1Heading')}
          </h2>
          <p>{t('privacy1Body')}</p>
        </section>
        <section>
          <h2 className="mb-3 font-[family-name:var(--font-display)] text-[22px] font-normal text-[var(--text)]">
            {t('privacy2Heading')}
          </h2>
          <p>{t('privacy2Body')}</p>
        </section>
        <section>
          <h2 className="mb-3 font-[family-name:var(--font-display)] text-[22px] font-normal text-[var(--text)]">
            {t('privacy3Heading')}
          </h2>
          <p>
            {t('privacy3BodyBefore')}
            <a
              href="https://policies.google.com/privacy"
              target="_blank"
              rel="noreferrer"
              className="text-[var(--primary)] hover:underline"
            >
              {t('privacy3LinkLabel')}
            </a>
            {t('privacy3BodyAfter')}
          </p>
        </section>
        <section>
          <h2 className="mb-3 font-[family-name:var(--font-display)] text-[22px] font-normal text-[var(--text)]">
            {t('privacy4Heading')}
          </h2>
          <p>{t('privacy4Body')}</p>
        </section>
        <section>
          <h2 className="mb-3 font-[family-name:var(--font-display)] text-[22px] font-normal text-[var(--text)]">
            {t('privacy5Heading')}
          </h2>
          <p>
            {t('privacy5BodyBefore')}
            <Link
              href="/support"
              className="text-[var(--primary)] hover:underline"
            >
              {t('privacy5LinkLabel')}
            </Link>
            {t('privacy5BodyAfter')}
          </p>
        </section>
        <section>
          <h2 className="mb-3 font-[family-name:var(--font-display)] text-[22px] font-normal text-[var(--text)]">
            {t('privacy6Heading')}
          </h2>
          <p>{t('privacy6Body')}</p>
        </section>
        <p className="mono border-t border-[var(--line)] pt-8 text-[11px] text-[var(--text-mute)]">
          {t('lastUpdated')}
        </p>
      </div>
    </main>
  )
}
