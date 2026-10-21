import type { Metadata } from 'next'
import Image from 'next/image'
import { getTranslations } from 'next-intl/server'

import { ResetPasswordForm } from '@/components/auth/reset-password-form'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('auth')
  return {
    title: `${t('resetButton')} | Clickit Story`,
    description: t('resetDescription'),
  }
}

export default async function ResetPasswordPage() {
  const t = await getTranslations('auth')
  return (
    <div className="relative flex min-h-[calc(100dvh-4rem)] items-center justify-center overflow-hidden px-4 py-12 sm:px-6">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,var(--uis-primary-soft)_0%,var(--bg-0)_62%)]"
      />

      <div className="relative z-10 w-full max-w-[440px]">
        <div className="mb-8 flex justify-center">
          <Image
            src="/brand/cit-story.png"
            alt="Clickit Story"
            width={140}
            height={40}
            priority
            className="h-10 w-auto brightness-0 invert"
          />
        </div>

        <div className="rounded-2xl border border-[var(--line)] bg-[var(--bg-1)] p-6 shadow-panel sm:p-8">
          <p className="mb-3 text-xs font-medium tracking-[0.2em] text-[var(--text-mute)] uppercase">
            {t('resetHeading')}
          </p>
          <h1 className="font-display text-[28px] leading-[1.2] font-semibold tracking-[-0.02em] text-[var(--text)]">
            {t('resetButton')}
          </h1>
          <p className="mt-2 mb-6 text-sm leading-6 text-[var(--text-dim)]">
            {t('resetDescription')}
          </p>

          <ResetPasswordForm />
        </div>
      </div>
    </div>
  )
}
