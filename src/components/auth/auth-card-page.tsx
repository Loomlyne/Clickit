import Image from 'next/image'

import { StepBar } from '@/components/auth/step-bar'

/**
 * Centered card frame for the single-purpose auth pages (UI-SPEC 5.1): the
 * reset-password frame, extracted. Top-aligned on phones so the keyboard never
 * pushes the content off, centered from `sm`. Inner order: step bar, icon,
 * overline, h1, subline, body.
 */
export function AuthCardPage({
  overline,
  title,
  subline,
  icon,
  step,
  children,
}: {
  overline?: React.ReactNode
  title: React.ReactNode
  subline?: React.ReactNode
  icon?: React.ReactNode
  step?: { current: number; total: number }
  children?: React.ReactNode
}) {
  return (
    <div className="relative flex min-h-[calc(100dvh-4rem)] items-start justify-center overflow-hidden px-4 py-8 sm:items-center sm:px-6 sm:py-12">
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

        <div className="rounded-panel border border-[var(--line)] bg-[var(--bg-1)] p-6 shadow-panel sm:p-8">
          {step && <StepBar current={step.current} total={step.total} />}
          {icon && (
            <div
              aria-hidden
              className="mb-4 flex size-11 items-center justify-center rounded-full bg-[var(--uis-primary-soft)] text-[var(--primary)]"
            >
              {icon}
            </div>
          )}
          {overline && (
            <p className="mb-2 text-[11px] leading-[1.4] font-normal tracking-[0.14em] text-[var(--text-mute)] uppercase">
              {overline}
            </p>
          )}
          <h1 className="font-display text-[24px] leading-[1.2] font-bold text-[var(--text)]">
            {title}
          </h1>
          {subline && (
            <p className="mt-2 mb-6 text-sm leading-normal text-[var(--text-dim)]">
              {subline}
            </p>
          )}
          {children}
        </div>
      </div>
    </div>
  )
}
