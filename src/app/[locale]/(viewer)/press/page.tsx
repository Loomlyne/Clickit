import type { Metadata } from 'next'
import { getLocale } from 'next-intl/server'

import { CompanyPage } from '@/components/company/company-page'

export const metadata: Metadata = {
  title: 'Press | Clickit Story',
  description: 'Press information for Clickit Story, including positioning and contact details.',
}

export default async function PressPage() {
  const locale = await getLocale()
  const isArabic = locale === 'ar'

  return (
    <CompanyPage
      eyebrow={isArabic ? 'للصحافة' : 'Press'}
      title={isArabic ? 'معلومات سريعة حول Clickit Story للصحافة والشركاء.' : 'Quick background on Clickit Story for press and partners.'}
      intro={isArabic
        ? 'هذه الصفحة تمنح نظرة مختصرة على المنصة، مجالها، وطريقة الحديث عنها في التغطيات الصحفية والملفات التعريفية.'
        : 'This page gives a concise briefing on the platform, its scope, and how to talk about it in press coverage and partner materials.'}
      sections={[
        {
          heading: isArabic ? 'التموضع' : 'Positioning',
          body: isArabic
            ? 'Clickit Story منصة مشاهدة تحريرية تعرض برامج أصلية في الثقافة والطعام والصحة والسفر والموسيقى والتصميم، مع تركيز على سرد أهدأ وأكثر قصداً.'
            : 'Clickit Story is an editorial streaming platform for original programming across culture, food, health, travel, music, and design, with a calmer and more intentional viewing model.',
        },
        {
          heading: isArabic ? 'ما الذي يميّزها' : 'What sets it apart',
          body: isArabic
            ? 'غياب الإعلانات، تخفيف الضوضاء البصرية، وتنظيم المكتبة كمساحة عرض منسّقة لا كخلاصة لا تنتهي. كل قرار في المنتج يخدم هذا الاتجاه.'
            : 'No advertising, reduced interface noise, and a library organized like a curated exhibition rather than an infinite feed. Product choices are meant to reinforce that.',
        },
        {
          heading: isArabic ? 'طلب المواد' : 'Asset requests',
          body: isArabic
            ? 'للحصول على شعار، لقطات شاشة، أو تنسيق مقابلة، استخدم صفحة الدعم مع ذكر الجهة الصحفية والموعد المطلوب.'
            : 'For logo files, screenshots, or interview coordination, use the support page and mention your publication plus the requested timeline.',
        },
      ]}
      ctaLabel={isArabic ? 'تواصل للصحافة' : 'Contact press'}
      ctaHref="/support"
    />
  )
}
