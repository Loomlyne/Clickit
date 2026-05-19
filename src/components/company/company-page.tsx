import { Link } from '@/i18n/navigation'

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
        <section className="rounded-[12px] border border-[var(--line)] bg-[linear-gradient(180deg,var(--bg-1),var(--bg-2))] px-6 py-10 sm:px-10 sm:py-14">
          <p className="mono mb-4 text-[var(--text-mute)]">{eyebrow}</p>
          <h1 className="font-display max-w-3xl text-[clamp(34px,6vw,68px)] leading-[0.96] tracking-[-0.04em] text-[var(--text)]">
            {title}
          </h1>
          <p className="mt-5 max-w-2xl text-[16px] leading-7 text-[var(--text-dim)]">
            {intro}
          </p>
          <Link
            href={ctaHref}
            className="mt-8 inline-flex min-h-11 items-center rounded-full border border-[var(--line-2)] px-5 py-3 text-sm text-[var(--text)] transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)]"
          >
            {ctaLabel}
          </Link>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          {sections.map((section) => (
            <article
              key={section.heading}
              className="rounded-[12px] border border-[var(--line)] bg-[var(--bg-1)] p-6"
            >
              <h2 className="font-display text-[24px] tracking-[-0.03em] text-[var(--text)]">
                {section.heading}
              </h2>
              <p className="mt-3 text-sm leading-7 text-[var(--text-dim)]">
                {section.body}
              </p>
            </article>
          ))}
        </section>
      </div>
    </div>
  )
}
