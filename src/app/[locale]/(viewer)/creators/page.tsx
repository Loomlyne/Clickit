import type { Metadata } from 'next'
import { getLocale } from 'next-intl/server'

import { CompanyPage } from '@/components/company/company-page'

export const metadata: Metadata = {
  title: 'Creators | Clickit Story',
  description: 'How Clickit Story works with directors, hosts, and original show creators.',
}

export default async function CreatorsPage() {
  const locale = await getLocale()
  const isArabic = locale === 'ar'

  return (
    <CompanyPage
      eyebrow={isArabic ? 'للمبدعين' : 'For creators'}
      title={isArabic ? 'نبحث عن أصوات لها وجهة نظر، لا عن محتوى سريع.' : 'We look for voices with point of view, not disposable content.'}
      intro={isArabic
        ? 'Clickit Story يعمل مع مضيفين ومخرجين وكتّاب ومنتجين يملكون حساً تحريرياً واضحاً. نهتم بالصياغة، وليس فقط بالوصول السريع.'
        : 'Clickit Story works with hosts, directors, writers, and producers who have a clear editorial point of view. Craft matters here, not just speed to publish.'}
      sections={[
        {
          heading: isArabic ? 'ما الذي نبحث عنه' : 'What we look for',
          body: isArabic
            ? 'أفكار أصلية يمكن أن تتحول إلى سلسلة لها إيقاع متماسك، هوية بصرية واضحة، وصوت يضيف شيئاً حقيقياً للمشهد الثقافي.'
            : 'Original concepts that can become a coherent series with visual identity, strong pacing, and a voice that adds something real to the cultural conversation.',
        },
        {
          heading: isArabic ? 'كيف نعمل' : 'How we work',
          body: isArabic
            ? 'نطوّر البرامج عبر جلسات تحرير، تجارب على النغمة البصرية، وتحديد واضح لسبب وجود كل حلقة. الهدف ليس الكثرة، بل الثبات في الجودة.'
            : 'Shows are developed through editorial sessions, visual tone shaping, and clear justification for why each episode exists. The goal is not volume, it is consistency of quality.',
        },
        {
          heading: isArabic ? 'كيف تبدأ' : 'How to start',
          body: isArabic
            ? 'إذا كان لديك مشروع أو شخصية أو صيغة برنامج مناسبة للمنصة، استخدم صفحة الدعم وقدّم الفكرة باختصار وروابط أعمالك السابقة.'
            : 'If you have a project, character, or format that fits the platform, use the support page and send a concise pitch with links to previous work.',
        },
      ]}
      ctaLabel={isArabic ? 'أرسل فكرة' : 'Send a pitch'}
      ctaHref="/support"
    />
  )
}
