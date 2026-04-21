import type { Metadata } from 'next'
import Image from 'next/image'
import { getTranslations } from 'next-intl/server'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { Button } from '@/components/ui/button'
import { ContactForm } from '@/components/support/contact-form'
import { FAQ_ITEMS } from '@/lib/faq-data'

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
      <div className="grid gap-8 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="rounded-[28px] border border-white/10 bg-white/[0.03] p-8 shadow-[0_24px_80px_rgba(0,0,0,0.22)]">
          <p className="mb-4 text-[11px] font-medium uppercase tracking-[0.28em] text-white/34">{t('pageTitle')}</p>
          <h1 className="font-display text-4xl font-semibold tracking-[-0.04em] text-foreground lg:text-5xl">
            {t('heading')}
          </h1>
          <p className="mt-4 max-w-md text-base leading-7 text-muted-foreground">
            {t('description')}
          </p>
          <div className="mt-8" aria-hidden="true">
            <Image
              src="/brand/Clickit_final_logo.svg"
              alt=""
              width={100}
              height={28}
              className="h-7 w-auto brightness-0 invert opacity-40 mb-4"
            />
            {/* 6-color brand strip */}
            <div className="flex gap-1.5">
              {['#2C3569', '#9F54A0', '#50A258', '#DB3F34', '#EA8C2E', '#F8C623'].map((color, i) => (
                <div
                  key={i}
                  className="h-1 rounded-full"
                  style={{ background: color, width: '2rem' }}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="rounded-[28px] border border-white/10 bg-white/[0.03] p-8 shadow-[0_24px_80px_rgba(0,0,0,0.22)]">
          <ContactForm />
        </div>
      </div>

      <section id="faq" className="mt-16">
        <h2 className="text-3xl font-semibold tracking-[-0.03em] text-foreground">{t('faqHeading')}</h2>
        <div className="mt-6 grid gap-6 md:grid-cols-2">
          <Accordion type="single" collapsible>
            {leftFaq.map((item, i) => (
              <AccordionItem key={i} value={`left-${i}`}>
                <AccordionTrigger className="text-sm text-foreground data-[state=open]:text-[var(--color-brand-blue-safe)]">{item.q}</AccordionTrigger>
                <AccordionContent className="text-sm text-muted-foreground">{item.a}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
          <Accordion type="single" collapsible>
            {rightFaq.map((item, i) => (
              <AccordionItem key={i} value={`right-${i}`}>
                <AccordionTrigger className="text-sm text-foreground data-[state=open]:text-[var(--color-brand-blue-safe)]">{item.q}</AccordionTrigger>
                <AccordionContent className="text-sm text-muted-foreground">{item.a}</AccordionContent>
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
