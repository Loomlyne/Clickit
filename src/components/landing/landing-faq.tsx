import Link from 'next/link'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { FAQ_ITEMS } from '@/lib/faq-data'

const LANDING_FAQS = FAQ_ITEMS.slice(0, 5)

export function LandingFaq() {
  return (
    <section className="px-6 md:px-12">
      <div className="mx-auto max-w-7xl">
        <div className="grid gap-16 lg:grid-cols-[1fr_1.6fr] lg:gap-24">
          {/* Left: sticky editorial heading */}
          <div className="lg:sticky lg:top-32" style={{ height: 'fit-content' }}>
            <p className="mb-4 text-[11px] font-bold uppercase tracking-[0.32em] text-white/28">
              FAQ
            </p>
            <h2
              className="font-display font-black leading-[0.92] text-white"
              style={{ fontSize: 'clamp(2.5rem, 5vw, 4rem)', letterSpacing: '-0.05em' }}
            >
              Questions,{' '}
              <span className="text-white/28">answered.</span>
            </h2>
            <p className="mt-5 text-sm leading-7 text-white/44 md:text-base">
              Everything you need to know about Clickit Story — free, original, and built in Abu Dhabi.
            </p>
            <Link
              href="/support#faq"
              className="mt-8 inline-flex items-center gap-2 text-sm font-medium text-white/40 transition-colors hover:text-white/80"
            >
              All FAQs and support →
            </Link>
          </div>

          {/* Right: accordion */}
          <Accordion type="single" collapsible className="w-full">
            {LANDING_FAQS.map((item, i) => (
              <AccordionItem key={i} value={`faq-${i}`}>
                <AccordionTrigger className="text-left text-base font-medium text-white/80 hover:text-white data-[state=open]:text-white">
                  {item.q}
                </AccordionTrigger>
                <AccordionContent className="text-sm leading-7 text-white/44">
                  {item.a}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </div>
    </section>
  )
}
