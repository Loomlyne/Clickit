import type { Metadata } from 'next'
import Image from 'next/image'
import { getTranslations } from 'next-intl/server'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { Button } from '@/components/ui/button'
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
  const splitAt = Math.ceil(faqItems.length / 2)
  const leftFaq = faqItems.slice(0, splitAt)
  const rightFaq = faqItems.slice(splitAt)

  return (
    <div
      id="support-top"
      className="px-4 pt-6 pb-16 sm:px-6 sm:pt-8 sm:pb-20 md:px-12"
    >
      <div className="grid gap-px overflow-hidden rounded-[12px] border border-[var(--line)] bg-[var(--line)] lg:grid-cols-[1.05fr_0.95fr]">
        {/* Left — info panel */}
        <div className="bg-[var(--bg-1)] p-6 sm:p-8 lg:p-10">
          <p className="mb-3 font-mono text-[11px] tracking-[0.28em] text-[var(--text-mute)] uppercase sm:mb-4">
            {t('pageTitle')}
          </p>
          <h1 className="font-display text-foreground text-[clamp(28px,5vw,48px)] leading-[1.05] font-semibold tracking-[-0.04em]">
            {t('heading')}
          </h1>
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
                '#2C3569',
                '#9F54A0',
                '#50A258',
                '#DB3F34',
                '#EA8C2E',
                '#F8C623',
              ].map((color, i) => (
                <div
                  key={i}
                  className="h-[3px] w-6 rounded-[1px] sm:w-8"
                  style={{ background: color }}
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

      <section id="faq" className="mt-12 sm:mt-16">
        <h2 className="font-display text-foreground text-[clamp(24px,4vw,30px)] font-semibold tracking-[-0.03em]">
          {t('faqHeading')}
        </h2>
        <div className="mt-5 grid gap-4 sm:mt-6 sm:gap-6 md:grid-cols-2">
          <Accordion type="single" collapsible>
            {leftFaq.map((item, i) => (
              <AccordionItem
                key={i}
                value={`left-${i}`}
                className="border-[var(--line)]"
              >
                <AccordionTrigger className="text-foreground text-[15px] data-[state=open]:text-[var(--accent-yellow)] sm:text-sm">
                  {item.q}
                </AccordionTrigger>
                <AccordionContent className="text-[14px] text-[var(--text-dim)] sm:text-sm">
                  {item.a}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
          <Accordion type="single" collapsible>
            {rightFaq.map((item, i) => (
              <AccordionItem
                key={i}
                value={`right-${i}`}
                className="border-[var(--line)]"
              >
                <AccordionTrigger className="text-foreground text-[15px] data-[state=open]:text-[var(--accent-yellow)] sm:text-sm">
                  {item.q}
                </AccordionTrigger>
                <AccordionContent className="text-[14px] text-[var(--text-dim)] sm:text-sm">
                  {item.a}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
        <Button variant="default" className="mt-8 min-h-[44px]" asChild>
          <a href="#contact-form">{t('contactHeading')}</a>
        </Button>
      </section>
    </div>
  )
}
