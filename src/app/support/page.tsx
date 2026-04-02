import type { Metadata } from 'next'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { Button } from '@/components/ui/button'
import { ContactForm } from '@/components/support/contact-form'

export const metadata: Metadata = {
  title: 'Support | Clickit Story',
  description: 'Get help with Clickit Story — contact us or browse FAQs',
}

const FAQ_ITEMS = [
  { q: 'What is Clickit Story?', a: 'Clickit Story is a streaming platform featuring original shows produced by Spacelight Studios FZ LLC from Abu Dhabi, UAE. We offer content spanning travel, health, music, comedy, cooking, poetry, tech, and more.' },
  { q: 'How do I watch shows?', a: 'Simply browse our catalog, pick a show, choose an episode, and press play. All content streams via our integrated video player — no downloads needed.' },
  { q: 'Is Clickit Story free?', a: 'Yes! Clickit Story is currently free to watch. Create an account to save your progress and build your watchlist.' },
  { q: 'What languages are available?', a: 'Most of our shows are available in Arabic and English. Some documentaries include French subtitles. Language availability is shown on each show detail page.' },
  { q: 'How do I contact support?', a: 'Use the contact form on this page or email us directly. Our support team responds within 24 hours during business days (Sunday\u2013Thursday, GST).' },
  { q: 'Can I download episodes?', a: 'Offline downloads are not currently available. All content is streamed online for the best viewing experience.' },
  { q: 'What devices are supported?', a: 'Clickit Story works on any device with a modern web browser — desktop, tablet, and mobile. We recommend Chrome, Safari, or Firefox for the best experience.' },
  { q: 'How do I report a problem?', a: 'If you encounter any issues, please use the contact form above or email our support team with a description of the problem and the device/browser you are using.' },
]

export default function SupportPage() {
  const leftFaq = FAQ_ITEMS.slice(0, 4)
  const rightFaq = FAQ_ITEMS.slice(4)

  return (
    <div className="px-6 pt-12 pb-16 md:px-12">
      {/* Hero + Contact Form */}
      <div className="grid gap-12 lg:grid-cols-2">
        {/* Left: heading + decoration */}
        <div>
          <h1 className="text-4xl font-bold text-foreground lg:text-5xl">Get in Touch</h1>
          <p className="mt-4 max-w-md text-base text-muted-foreground">
            Have a question, feedback, or need help? We&apos;d love to hear from you. Our team is based in Abu Dhabi and responds within 24 hours.
          </p>
          {/* Decorative poster mosaic */}
          <div className="mt-8 grid grid-cols-3 gap-2" aria-hidden="true">
            {['bg-brand-blue', 'bg-brand-purple', 'bg-brand-green', 'bg-brand-red', 'bg-brand-orange', 'bg-brand-yellow', 'bg-brand-blue', 'bg-brand-purple', 'bg-brand-green'].map((c, i) => (
              <div key={i} className={`aspect-video rounded-md ${c} opacity-30`} />
            ))}
          </div>
        </div>

        {/* Right: contact form */}
        <div>
          <ContactForm />
        </div>
      </div>

      {/* FAQ Section */}
      <section id="faq" className="mt-16">
        <h2 className="text-2xl font-bold text-foreground">Frequently Asked Questions</h2>
        <div className="mt-6 grid gap-6 md:grid-cols-2">
          <Accordion type="single" collapsible>
            {leftFaq.map((item, i) => (
              <AccordionItem key={i} value={`left-${i}`}>
                <AccordionTrigger className="text-sm text-foreground">{item.q}</AccordionTrigger>
                <AccordionContent className="text-sm text-muted-foreground">{item.a}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
          <Accordion type="single" collapsible>
            {rightFaq.map((item, i) => (
              <AccordionItem key={i} value={`right-${i}`}>
                <AccordionTrigger className="text-sm text-foreground">{item.q}</AccordionTrigger>
                <AccordionContent className="text-sm text-muted-foreground">{item.a}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
        <Button variant="secondary" className="mt-8" asChild>
          <a href="#top">Ask a Question</a>
        </Button>
      </section>
    </div>
  )
}
