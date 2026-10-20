import { PageEyebrow, PageTitle } from '@/components/info/page-header'

/**
 * Shared shell for Privacy, Terms and /legal/[slug]. No <main> here: the
 * locale layout already provides the page landmark.
 */
export function LegalDocument({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string
  title: string
  children: React.ReactNode
}) {
  return (
    <div className="mx-auto max-w-[860px] px-4 pt-12 pb-20 sm:px-6 md:px-10 md:pt-16 md:pb-24">
      <PageEyebrow>{eyebrow}</PageEyebrow>
      <PageTitle className="mb-10">{title}</PageTitle>
      <div className="text-[16px] leading-7 text-[var(--text-dim)]">
        {children}
      </div>
    </div>
  )
}

export function LegalSection({
  heading,
  children,
}: {
  heading: string
  children: React.ReactNode
}) {
  return (
    <section className="border-t border-[var(--line)] py-7 first:border-t-0 first:pt-0">
      <h2 className="font-display mb-2.5 text-[24px] leading-tight tracking-[-0.02em] text-[var(--text)]">
        {heading}
      </h2>
      <p>{children}</p>
    </section>
  )
}

/** Inline link inside legal copy: underlined so colour is not the only cue. */
export const legalLinkClass =
  'text-[var(--primary)] underline decoration-1 underline-offset-4 hover:decoration-2'

export function LegalUpdated({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-2 border-t border-[var(--line)] pt-6 font-[family-name:var(--font-app)] text-[11px] tracking-[0.08em] uppercase text-[var(--text-mute)]">
      {children}
    </p>
  )
}
