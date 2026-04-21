import type { Metadata } from 'next'
import Image from 'next/image'

import { AuthPanel } from '@/components/auth/auth-panel'
import { BotIdInit } from '@/components/auth/botid-init'
import { CinematicBackdrop } from '@/components/primitives/cinematic-backdrop'

export const metadata: Metadata = {
  title: 'Sign In | Clickit Story',
  description: 'Sign in or create a Clickit Story account',
}

const BRAND_COLORS = ['#2C3569', '#9F54A0', '#50A258', '#DB3F34', '#EA8C2E', '#F8C623']

export default function AuthPage() {
  return (
    <div className="-mt-24 md:-mt-28 relative flex min-h-dvh items-center justify-center overflow-hidden px-6 py-16">
      <BotIdInit />
      <CinematicBackdrop
        brandColor="#2C3569"
        intensity="high"
        watermarkText="CIT"
        className="absolute inset-0"
      />

      <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/50 to-black pointer-events-none" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_20%,rgba(0,0,0,0.8)_70%)] pointer-events-none" />

      <div className="relative z-10 grid w-full max-w-6xl gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
        <div className="hidden lg:block">
          <p className="mb-4 text-[11px] font-medium uppercase tracking-[0.28em] text-white/34">
            Clickit access
          </p>
          <h1 className="font-display max-w-xl text-[clamp(3rem,5vw,5.4rem)] font-semibold leading-[0.94] text-white">
            Sign in to a more deliberate streaming experience.
          </h1>
          <p className="mt-5 max-w-lg text-lg leading-8 text-white/58">
            Save your list, resume where you left off, and move through Clickit’s original programming with a cleaner viewer shell.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            {['Original programming', 'Progress sync', 'Watchlist ready'].map((item) => (
              <span key={item} className="rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-sm text-white/60">
                {item}
              </span>
            ))}
          </div>
        </div>

        <div className="relative z-10 w-full max-w-[440px] justify-self-center lg:justify-self-end">
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
              Welcome back
            </p>
            <h2 className="font-display text-[2rem] font-semibold tracking-[-0.03em] text-white">
              Continue where you left off
            </h2>
            <p className="mb-8 mt-2 text-sm leading-6 text-white/52">
              Sign in or create an account to save progress, manage your list, and unlock the full Clickit viewer experience.
            </p>

            <AuthPanel />
          </div>

          <div className="mt-6 flex justify-center gap-1.5">
            {BRAND_COLORS.map((color, i) => (
              <div
                key={i}
                className="h-1 w-6 rounded-full"
                style={{ background: color, opacity: 0.7 }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
