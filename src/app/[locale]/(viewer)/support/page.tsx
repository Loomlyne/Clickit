import type { Metadata } from 'next'
import Image from 'next/image'
import { getTranslations } from 'next-intl/server'
import { Button } from '@/components/ui/button'
import { FaqAccordion } from '@/components/landing/faq-accordion'
import { PageEyebrow, PageTitle } from '@/components/info/page-header'
import { ContactForm } from '@/components/support/contact-form'
import { getFaqsPublic } from '@/lib/queries'
import { pickLocalized } from '@/lib/locale'
import { getLocale } from '@/lib/locale-server'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('support')
  return {
    title: `${t('pageTitle')} | Clickit Story`,
    description: t('description'),
  }
}

export default async function SupportPage() {
  const [t, tFaq, dbFaqs, locale] = await Promise.all([
    getTranslations('support'),
    getTranslations('faq'),
    getFaqsPublic(),
    getLocale(),
  ])

  // Use the admin-managed FAQs (same `faqs` table as the landing page) so both
  // pages stay in sync from one source. Fall back to the i18n faq namespace
  // (q1Question..q8Answer) only when no FAQs have been configured yet. Arabic
  // question/answer shown when locale is ar, English as fallback.
  const faqItems =
    dbFaqs.length > 0
      ? dbFaqs.map((f) => ({
          q: pickLocalized(locale, f.question, f.question_ar),
          a: pickLocalized(locale, f.answer, f.answer_ar),
        }))
      : [1, 2, 3, 4, 5, 6, 7, 8].map((i) => ({
          q: tFaq(`q${i}Question`),
          a: tFaq(`q${i}Answer`),
        }))

  return (
    <div
      id="support-top"
      className="px-4 pt-6 pb-16 sm:px-6 sm:pt-8 sm:pb-20 md:px-12"
    >
      <div className="grid gap-px overflow-hidden rounded-card border border-[var(--line)] bg-[var(--line)] lg:grid-cols-[1.05fr_0.95fr]">
        {/* Left — info panel */}
        <div className="bg-[var(--bg-1)] p-6 sm:p-8 lg:p-10">
          <PageEyebrow className="mb-3 sm:mb-4">{t('pageTitle')}</PageEyebrow>
          <PageTitle size="panel">{t('heading')}</PageTitle>
          <p className="mt-4 max-w-md text-[15px] leading-relaxed text-[var(--text-dim)] sm:text-base sm:leading-7">
            {t('description')}
          </p>
          <div className="mt-8 sm:mt-10" aria-hidden="true">
            <Image
              src="/brand/cit-story.png"
              alt=""
              width={100}
              height={28}
              className="mb-4 h-7 w-auto opacity-30 brightness-0 invert"
            />
            {/* 6-color brand strip */}
            <div className="flex gap-1.5">
              {[
                'bg-brand-blue',
                'bg-brand-purple',
                'bg-brand-green',
                'bg-brand-red',
                'bg-brand-orange',
                'bg-brand-yellow',
              ].map((color) => (
                <div
                  key={color}
                  className={`h-[3px] w-6 rounded-hairline sm:w-8 ${color}`}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Right — contact form */}
        <div className="bg-[var(--bg-1)] p-6 sm:p-8 lg:p-10">
          <ContactForm />
        </div>
      </div>

      <section id="faq" className="mt-14 sm:mt-16">
        <h2 className="font-display mx-auto mb-6 max-w-[860px] text-[clamp(30px,3.4vw,40px)] leading-[1.1] font-normal tracking-[-0.02em]">
          {t('faqHeading')}
        </h2>
        <FaqAccordion items={faqItems} />
        <div className="mx-auto mt-8 max-w-[860px]">
          <Button variant="default" asChild>
            <a href="#contact-form">{t('contactHeading')}</a>
          </Button>
        </div>
      </section>
    </div>
  )
}
