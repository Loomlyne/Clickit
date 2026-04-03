import type { Metadata } from 'next'
import Image from 'next/image'

import { AuthPanel } from '@/components/auth/auth-panel'
import { CinematicBackdrop } from '@/components/primitives/cinematic-backdrop'

export const metadata: Metadata = {
  title: 'Sign In | Clickit Story',
  description: 'Sign in or create a Clickit Story account',
}

const BRAND_COLORS = ['#2C3569', '#9F54A0', '#50A258', '#DB3F34', '#EA8C2E', '#F8C623']

export default function AuthPage() {
  return (
    <div className="-mt-16 relative min-h-screen flex items-center justify-center overflow-hidden">
      {/* Cinematic background — same treatment as hero */}
      <CinematicBackdrop
        brandColor="#2C3569"
        intensity="high"
        watermarkText="CIT"
        className="absolute inset-0"
      />

      {/* Gradient overlays */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/50 to-black pointer-events-none" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_20%,rgba(0,0,0,0.8)_70%)] pointer-events-none" />

      {/* Auth card — glass morphism, centered */}
      <div className="relative z-10 w-full max-w-[420px] mx-6 my-12">
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <Image
            src="/brand/Clickit_final_logo.svg"
            alt="Clickit Story"
            width={140}
            height={40}
            priority
            className="h-10 w-auto brightness-0 invert"
          />
        </div>

        {/* Glass card */}
        <div
          className="rounded-2xl p-8 backdrop-blur-xl"
          style={{
            background: 'rgba(17, 17, 22, 0.85)',
            border: '1px solid rgba(255,255,255,0.08)',
            boxShadow: '0 32px 64px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.05)',
          }}
        >
          {/* Heading — Playfair Display */}
          <h2
            className="font-display font-semibold text-white text-center mb-1"
            style={{ fontSize: '1.75rem' }}
          >
            Welcome back
          </h2>
          <p className="text-white/50 text-sm text-center mb-8">
            Sign in to continue watching
          </p>

          <AuthPanel />
        </div>

        {/* Brand strip */}
        <div className="flex justify-center gap-1.5 mt-8">
          {BRAND_COLORS.map((color, i) => (
            <div
              key={i}
              className="w-6 h-1 rounded-full"
              style={{ background: color, opacity: 0.6 }}
            />
          ))}
        </div>

        {/* Tagline */}
        <p className="text-center text-white/30 text-xs mt-4">
          Stream original content from the UAE
        </p>
      </div>
    </div>
  )
}
