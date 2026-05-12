import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'

import { NewsletterSignupForm } from '@/components/layout/newsletter-signup-form'
import { createClient } from '@/lib/supabase/server'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('updates')
  return {
    title: t('metaTitle'),
    description: t('metaDescription'),
  }
}

export default async function UpdatesPage({
  searchParams,
}: {
  searchParams?: Promise<{ show?: string }>
}) {
  const t = await getTranslations('updates')
  const params = await searchParams
  const showSlug = params?.show?.trim() || undefined
  const showTitle = showSlug ? showSlug.replace(/-/g, ' ') : undefined

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const defaultEmail = user?.email ?? ''

  return (
    <div className="px-4 pb-16 pt-8 sm:px-6 md:px-12">
      <div className="mx-auto max-w-3xl rounded-[24px] border border-[var(--line)] bg-[var(--bg-1)] p-6 sm:p-10">
        <p className="mono mb-4 text-[var(--text-mute)]">
          {t('eyebrow')}
        </p>
        <h1 className="font-display text-[clamp(34px,6vw,60px)] leading-[0.98] tracking-[-0.04em] text-[var(--text)]">
          {t('heading')}
        </h1>
        <p className="mt-4 max-w-2xl text-[16px] leading-7 text-[var(--text-dim)]">
          {showTitle ? t('descriptionForShow', { showTitle }) : t('descriptionGeneric')}
        </p>
        <div className="mt-8">
          <NewsletterSignupForm
            source={showSlug ? 'coming-soon' : 'updates-page'}
            interestSlug={showSlug}
            interestTitle={showTitle}
            defaultEmail={defaultEmail}
            buttonLabel={t('buttonLabel')}
            compact={false}
          />
        </div>
      </div>
    </div>
  )
}
