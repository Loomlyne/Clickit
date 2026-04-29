import type { Metadata } from 'next'
import { getLocale } from 'next-intl/server'

import { CompanyPage } from '@/components/company/company-page'

export const metadata: Metadata = {
  title: 'Membership | Clickit Story',
  description: 'Membership details for Clickit Story annual access.',
}

export default async function MembershipPage() {
  const locale = await getLocale()
  const isArabic = locale === 'ar'

  return (
    <CompanyPage
      eyebrow={isArabic ? 'العضوية' : 'Membership'}
      title={isArabic ? 'خطط الوصول الموسّع إلى Clickit Story.' : 'Extended access plans for Clickit Story.'}
      intro={isArabic
        ? 'ما زلنا في مرحلة التوسّع. هذه الصفحة توضّح ما نختبره حالياً: ملفات تعريف إضافية، وصول مبكر، وتجربة مشاهدة أعلى جودة عند إطلاق الخطط المدفوعة.'
        : 'Clickit Story is still in expansion mode. This page explains the membership bundle currently being tested: more profiles, early access windows, and higher-quality streaming when paid plans go live.'}
      sections={[
        {
          heading: isArabic ? 'ما الذي يتضمنه' : 'What is included',
          body: isArabic
            ? 'الوصول السنوي المبدئي يشمل أربع ملفات تعريف، أولوية في مشاهدة الإصدارات الجديدة، وتجربة مشاهدة محسّنة للأجهزة المنزلية الكبيرة.'
            : 'The annual preview bundle includes four profiles, priority access to new releases, and a higher-fidelity viewing setup for larger screens at home.',
        },
        {
          heading: isArabic ? 'متى يتاح' : 'When it launches',
          body: isArabic
            ? 'لن يتم تحصيل أي مبلغ من هذه الصفحة. نجمع الاهتمام أولاً، ثم نفتح الوصول عندما تكون البنية التشغيلية جاهزة بالكامل.'
            : 'Nothing is charged from this page. Interest is collected first, then access opens once the operational stack is fully ready.',
        },
        {
          heading: isArabic ? 'لمن هي' : 'Who it is for',
          body: isArabic
            ? 'هذه الخطة مناسبة للمشاهدين الذين يريدون الوصول المبكر ومشاركة الحساب داخل المنزل بدون فقدان الطابع التحريري الهادئ للمنصة.'
            : 'This plan is for viewers who want early access and multi-profile household viewing without losing the platform’s editorial feel.',
        },
      ]}
      ctaLabel={isArabic ? 'سجّل اهتمامك' : 'Register your interest'}
      ctaHref="/updates"
    />
  )
}
