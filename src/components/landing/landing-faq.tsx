import { getTranslations } from 'next-intl/server'
import { getFaqsPublic } from '@/lib/queries'
import { pickLocalized } from '@/lib/locale'
import { getLocale } from '@/lib/locale-server'
import { FaqAccordion } from './faq-accordion'

export async function LandingFaq() {
  const [dbFaqs, t, locale] = await Promise.all([
    getFaqsPublic(),
    getTranslations('landing'),
    getLocale(),
  ])

  // Use DB-managed FAQs when any exist; fall back to the i18n defaults so the
  // landing page always shows something even on a fresh install. Each FAQ shows
  // its Arabic question/answer when the viewer's locale is ar (English fallback).
  const items =
    dbFaqs.length > 0
      ? dbFaqs.map((f) => ({
          q: pickLocalized(locale, f.question, f.question_ar),
          a: pickLocalized(locale, f.answer, f.answer_ar),
        }))
      : [
          { q: t('faq1Q'), a: t('faq1A') },
          { q: t('faq2Q'), a: t('faq2A') },
          { q: t('faq3Q'), a: t('faq3A') },
          { q: t('faq4Q'), a: t('faq4A') },
          { q: t('faq5Q'), a: t('faq5A') },
        ]

  return (
    <section
      className="mx-auto max-w-[1400px] border-t border-[var(--line)] px-10 py-24"
      id="faq"
    >
      <h2 className="mb-12 font-[family-name:var(--font-display)] text-[clamp(36px,5vw,64px)] leading-none font-normal tracking-[-0.02em]">
        {t('faqHeading')}
      </h2>
      <FaqAccordion items={items} />
    </section>
  )
}
