import type { Metadata } from 'next'
import Image from 'next/image'

import { ResetPasswordForm } from '@/components/auth/reset-password-form'
import { CinematicBackdrop } from '@/components/primitives/cinematic-backdrop'

export const metadata: Metadata = {
  title: 'Reset Password | Clickit Story',
  description: 'Set a new password for your Clickit Story account',
}

export default function ResetPasswordPage() {
  return (
    <div className="-mt-24 md:-mt-28 relative flex min-h-dvh items-center justify-center overflow-hidden px-6 py-16">
      <CinematicBackdrop
        brandColor="#2C3569"
        intensity="high"
        watermarkText="CIT"
        className="absolute inset-0"
      />

      <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/50 to-black pointer-events-none" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_20%,rgba(0,0,0,0.8)_70%)] pointer-events-none" />

      <div className="relative z-10 w-full max-w-[440px]">
        <div className="mb-8 flex justify-center">
          <Image
            src="/brand/Clickit_final_logo.svg"
            alt="Clickit Story"
            width={140}
            height={40}
            priority
            className="h-10 w-auto brightness-0 invert"
          />
        </div>

        <div
          className="rounded-[28px] border border-white/10 p-8 backdrop-blur-xl"
          style={{
            background: 'rgba(12, 15, 21, 0.88)',
            boxShadow: '0 32px 90px rgba(0,0,0,0.42), inset 0 1px 0 rgba(255,255,255,0.04)',
          }}
        >
          <p className="mb-3 text-[11px] font-medium uppercase tracking-[0.28em] text-white/34">
            Account recovery
          </p>
          <h2 className="font-display text-[2rem] font-semibold tracking-[-0.03em] text-white">
            Set new password
          </h2>
          <p className="mb-8 mt-2 text-sm leading-6 text-white/52">
            Enter your new password below.
          </p>

          <ResetPasswordForm />
        </div>
      </div>
    </div>
  )
}
