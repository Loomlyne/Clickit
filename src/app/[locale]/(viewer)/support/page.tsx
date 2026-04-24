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
    <div className="px-6 pb-20 pt-8 md:px-12">
      <div className="grid gap-px overflow-hidden rounded-[6px] border border-[var(--line)] bg-[var(--line)] lg:grid-cols-[1.05fr_0.95fr]">
        {/* Left — info panel */}
        <div className="bg-[var(--bg-1)] p-8 lg:p-10">
          <p className="mb-4 font-mono text-[11px] uppercase tracking-[0.28em] text-[var(--text-mute)]">{t('pageTitle')}</p>
          <h1 className="font-display text-4xl font-semibold tracking-[-0.04em] text-foreground lg:text-5xl">
            {t('heading')}
          </h1>
          <p className="mt-4 max-w-md text-base leading-7 text-[var(--text-dim)]">
            {t('description')}
          </p>
          <div className="mt-10" aria-hidden="true">
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
                  className="h-[3px] rounded-[1px]"
                  style={{ background: color, width: '2rem' }}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Right — contact form */}
        <div className="bg-[var(--bg-1)] p-8 lg:p-10">
          <ContactForm />
        </div>
      </div>

      <section id="faq" className="mt-16">
        <h2 className="font-display text-3xl font-semibold tracking-[-0.03em] text-foreground">{t('faqHeading')}</h2>
        <div className="mt-6 grid gap-6 md:grid-cols-2">
          <Accordion type="single" collapsible>
            {leftFaq.map((item, i) => (
              <AccordionItem key={i} value={`left-${i}`} className="border-[var(--line)]">
                <AccordionTrigger className="text-sm text-foreground data-[state=open]:text-[var(--accent-yellow)]">{item.q}</AccordionTrigger>
                <AccordionContent className="text-sm text-[var(--text-dim)]">{item.a}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
          <Accordion type="single" collapsible>
            {rightFaq.map((item, i) => (
              <AccordionItem key={i} value={`right-${i}`} className="border-[var(--line)]">
                <AccordionTrigger className="text-sm text-foreground data-[state=open]:text-[var(--accent-yellow)]">{item.q}</AccordionTrigger>
                <AccordionContent className="text-sm text-[var(--text-dim)]">{item.a}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
        <Button
          variant="default"
          className="mt-8"
          asChild
        >
          <a href="#top">{t('contactHeading')}</a>
        </Button>
      </section>
    </div>
  )
}
