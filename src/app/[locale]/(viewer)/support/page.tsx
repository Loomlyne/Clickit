import type { Metadata } from 'next'
import Image from 'next/image'
import { getTranslations } from 'next-intl/server'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { Button } from '@/components/ui/button'
import { ContactForm } from '@/components/support/contact-form'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('support')
  return {
    title: `${t('pageTitle')} | Clickit Story`,
    description: t('description'),
  }
}

export default async function SupportPage() {
  const [t, tFaq] = await Promise.all([
    getTranslations('support'),
    getTranslations('faq'),
  ])

  // Build FAQ items from the faq namespace keys (q1Question..q8Answer)
  const faqItems = [1, 2, 3, 4, 5, 6, 7, 8].map((i) => ({
    q: tFaq(`q${i}Question`),
    a: tFaq(`q${i}Answer`),
  }))
  const leftFaq = faqItems.slice(0, 4)
  const rightFaq = faqItems.slice(4)

  return (
    <div id="support-top" className="px-4 pb-16 pt-6 sm:px-6 sm:pb-20 sm:pt-8 md:px-12">
      <div className="grid gap-px overflow-hidden rounded-[24px] border border-[var(--line)] bg-[var(--line)] lg:grid-cols-[1.05fr_0.95fr]">
        {/* Left — info panel */}
        <div className="bg-[var(--bg-1)] p-6 sm:p-8 lg:p-10">
          <p className="mb-3 font-mono text-[11px] uppercase tracking-[0.28em] text-[var(--text-mute)] sm:mb-4">{t('pageTitle')}</p>
          <h1 className="font-display text-[clamp(28px,5vw,48px)] font-semibold leading-[1.05] tracking-[-0.04em] text-foreground">
            {t('heading')}
          </h1>
          <p className="mt-4 max-w-md text-[15px] leading-relaxed text-[var(--text-dim)] sm:text-base sm:leading-7">
            {t('description')}
          </p>
          <div className="mt-8 sm:mt-10" aria-hidden="true">
            <Image
              src="/brand/Clickit_final_logo.svg"
              alt=""
              width={100}
              height={28}
              className="h-7 w-auto brightness-0 invert opacity-30 mb-4"
            />
            {/* 6-color brand strip */}
            <div className="flex gap-1.5">
              {['#2C3569', '#9F54A0', '#50A258', '#DB3F34', '#EA8C2E', '#F8C623'].map((color, i) => (
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
        <h2 className="font-display text-[clamp(24px,4vw,30px)] font-semibold tracking-[-0.03em] text-foreground">{t('faqHeading')}</h2>
        <div className="mt-5 grid gap-4 sm:mt-6 sm:gap-6 md:grid-cols-2">
          <Accordion type="single" collapsible>
            {leftFaq.map((item, i) => (
              <AccordionItem key={i} value={`left-${i}`} className="border-[var(--line)]">
                <AccordionTrigger className="text-[15px] text-foreground data-[state=open]:text-[var(--accent-yellow)] sm:text-sm">{item.q}</AccordionTrigger>
                <AccordionContent className="text-[14px] text-[var(--text-dim)] sm:text-sm">{item.a}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
          <Accordion type="single" collapsible>
            {rightFaq.map((item, i) => (
              <AccordionItem key={i} value={`right-${i}`} className="border-[var(--line)]">
                <AccordionTrigger className="text-[15px] text-foreground data-[state=open]:text-[var(--accent-yellow)] sm:text-sm">{item.q}</AccordionTrigger>
                <AccordionContent className="text-[14px] text-[var(--text-dim)] sm:text-sm">{item.a}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
        <Button
          variant="default"
          className="mt-8 min-h-[44px]"
          asChild
        >
          <a href="#contact-form">{t('contactHeading')}</a>
        </Button>
      </section>
    </div>
  )
}
