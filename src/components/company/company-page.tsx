import { Link } from '@/i18n/navigation'
import { Button } from '@/components/ui/button'
import { PageEyebrow, PageTitle } from '@/components/info/page-header'

type CompanyPageProps = {
  eyebrow: string
  title: string
  intro: string
  sections: Array<{
    heading: string
    body: string
  }>
  ctaLabel: string
  ctaHref: string
}

export function CompanyPage({
  eyebrow,
  title,
  intro,
  sections,
  ctaLabel,
  ctaHref,
}: CompanyPageProps) {
  return (
    <div className="px-4 pt-8 pb-16 sm:px-6 md:px-12">
      <div className="mx-auto max-w-5xl space-y-10">
        <section className="rounded-card border border-[var(--line)] bg-[var(--bg-1)] px-6 py-10 sm:px-10 sm:py-14">
          <PageEyebrow>{eyebrow}</PageEyebrow>
          <PageTitle className="max-w-3xl">{title}</PageTitle>
          <p className="mt-5 max-w-2xl text-[16px] leading-7 text-[var(--text-dim)]">
            {intro}
          </p>
          <Button size="lg" className="mt-8" asChild>
            <Link href={ctaHref}>{ctaLabel}</Link>
          </Button>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          {sections.map((section) => (
            <article
              key={section.heading}
              className="rounded-card border border-[var(--line)] bg-[var(--bg-1)] p-6"
            >
              <h2 className="font-display text-[24px] tracking-[-0.02em] text-[var(--text)]">
                {section.heading}
              </h2>
              <p className="mt-3 text-[15px] leading-relaxed text-[var(--text-dim)]">
                {section.body}
              </p>
            </article>
          ))}
        </section>
      </div>
    </div>
  )
}
