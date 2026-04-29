import type { Metadata } from 'next'
import { getLocale } from 'next-intl/server'

import { NewsletterSignupForm } from '@/components/layout/newsletter-signup-form'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = {
  title: 'Updates | Clickit Story',
  description: 'Get launch, release, and coming-soon updates from Clickit Story.',
}

export default async function UpdatesPage({
  searchParams,
}: {
  searchParams?: Promise<{ show?: string }>
}) {
  const locale = await getLocale()
  const isArabic = locale === 'ar'
  const params = await searchParams
  const showSlug = params?.show?.trim() || undefined

  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  const defaultEmail = session?.user?.email ?? ''

  return (
    <div className="px-4 pb-16 pt-8 sm:px-6 md:px-12">
      <div className="mx-auto max-w-3xl rounded-[6px] border border-[var(--line)] bg-[var(--bg-1)] p-6 sm:p-10">
        <p className="mono mb-4 text-[var(--text-mute)]">
          {isArabic ? 'تحديثات Clickit Story' : 'Clickit Story updates'}
        </p>
        <h1 className="font-display text-[clamp(34px,6vw,60px)] leading-[0.98] tracking-[-0.04em] text-[var(--text)]">
          {isArabic ? 'ابقَ قريباً من الإصدارات القادمة.' : 'Stay close to upcoming releases.'}
        </h1>
        <p className="mt-4 max-w-2xl text-[16px] leading-7 text-[var(--text-dim)]">
          {showSlug
            ? (isArabic
                ? `سنرسل لك تحديثات عند اقتراب إطلاق ${showSlug.replaceAll('-', ' ')} وأي أخبار مرتبطة به.`
                : `We’ll send you updates when ${showSlug.replaceAll('-', ' ')} gets closer to release, plus any related announcements.`)
            : (isArabic
                ? 'اشترك للحصول على أخبار الإطلاق، الإصدارات الجديدة، والتحديثات التحريرية.'
                : 'Subscribe for launch news, new-release drops, and editorial updates.')}
        </p>
        <div className="mt-8">
          <NewsletterSignupForm
            source={showSlug ? 'coming-soon' : 'updates-page'}
            interestSlug={showSlug}
            interestTitle={showSlug ? showSlug.replaceAll('-', ' ') : undefined}
            defaultEmail={defaultEmail}
            buttonLabel={isArabic ? 'أرسل لي التحديثات' : 'Send me updates'}
            compact={false}
          />
        </div>
      </div>
    </div>
  )
}
