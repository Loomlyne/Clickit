import type { Metadata } from 'next'
import { getLocale } from 'next-intl/server'

import { CompanyPage } from '@/components/company/company-page'

export const metadata: Metadata = {
  title: 'About | Clickit Story',
  description: 'About Clickit Story and the editorial point of view behind the platform.',
}

export default async function AboutPage() {
  const locale = await getLocale()
  const isArabic = locale === 'ar'

  return (
    <CompanyPage
      eyebrow={isArabic ? 'من نحن' : 'About Clickit Story'}
      title={isArabic ? 'منصة مشاهدة مبنية بذائقة تحريرية، لا بخوارزمية.' : 'A viewing platform built by editorial taste, not an algorithm.'}
      intro={isArabic
        ? 'Clickit Story يجمع برامج أصلية من أبوظبي ضمن تجربة مشاهدة هادئة ومقصودة. الفكرة بسيطة: عرض أقل، اختيار أوضح، ونبرة تحترم وقت المشاهد.'
        : 'Clickit Story brings original programming from Abu Dhabi into a calmer, more intentional viewing environment. The thesis is simple: less noise, clearer selection, and a tone that respects the viewer’s time.'}
      sections={[
        {
          heading: isArabic ? 'التحرير أولاً' : 'Editorial first',
          body: isArabic
            ? 'نبرمج المنصة كما تُبرمج مجلة أو قناة، مع اهتمام بالإيقاع، المزاج، وتسلسل الاكتشاف، بدلاً من إغراق المشاهد في واجهة مزدحمة.'
            : 'The platform is programmed like a magazine or a channel, with attention to pacing, mood, and discovery order instead of overwhelming the viewer with an overcrowded interface.',
        },
        {
          heading: isArabic ? 'من أبوظبي' : 'Built from Abu Dhabi',
          body: isArabic
            ? 'المحتوى ينطلق من المدينة، لكنه لا يقتصر عليها. السفر، الطعام، الصحة، الموسيقى، والتصميم تظهر هنا كعدسات متجاورة على المنطقة.'
            : 'The programming starts from the city but does not stay narrow. Travel, food, health, music, and design appear here as adjacent lenses on the region.',
        },
        {
          heading: isArabic ? 'مشاهدة كاملة' : 'Complete viewing',
          body: isArabic
            ? 'التجربة مصممة لتشجيع المشاهدة الكاملة للحلقة أو الموسم، مع انتقالات واضحة وحفظ للتقدم ومساحة لاكتشاف ما يلي بدون ضوضاء.'
            : 'The product is designed to encourage complete viewing of an episode or season, with clear navigation, saved progress, and room to discover what comes next without noise.',
        },
      ]}
      ctaLabel={isArabic ? 'تواصل مع الفريق' : 'Contact the team'}
      ctaHref="/support"
    />
  )
}
