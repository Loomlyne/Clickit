import Link from 'next/link'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { FAQ_ITEMS } from '@/lib/faq-data'

const LANDING_FAQS = FAQ_ITEMS.slice(0, 5)

export function LandingFaq() {
  return (
    <section className="mx-auto max-w-3xl px-6 md:px-12">
      <div className="mb-10">
        <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.24em] text-white/40">FAQ</p>
        <h2 className="font-display text-3xl font-semibold tracking-[-0.03em] text-foreground lg:text-4xl">
          Common questions
        </h2>
      </div>

      <Accordion type="single" collapsible className="w-full">
        {LANDING_FAQS.map((item, i) => (
          <AccordionItem key={i} value={`faq-${i}`}>
            <AccordionTrigger className="text-left text-base text-foreground data-[state=open]:text-[var(--color-brand-purple)]">
              {item.q}
            </AccordionTrigger>
            <AccordionContent className="text-sm leading-7 text-muted-foreground">
              {item.a}
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>

      <div className="mt-8">
        <Link
          href="/support#faq"
          className="text-sm text-white/48 transition-colors hover:text-white"
        >
          More questions → Visit Support
        </Link>
      </div>
    </section>
  )
}
