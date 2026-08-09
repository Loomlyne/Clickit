import type { LegalPage, Faq } from '@/app/[locale]/admin/actions'
import { LegalPagesEditor } from './legal-pages-editor'
import { FaqsEditor } from './faqs-editor'

export function LegalTab({
  legalPages,
  faqs,
}: {
  legalPages: LegalPage[]
  faqs: Faq[]
}) {
  return (
    <>
      <LegalPagesEditor initial={legalPages} />
      <FaqsEditor initial={faqs} />
    </>
  )
}
