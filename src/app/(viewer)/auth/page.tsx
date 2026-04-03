import type { Metadata } from 'next'
import Image from 'next/image'

import { AuthPanel } from '@/components/auth/auth-panel'
import { ShowCollage } from '@/components/auth/show-collage'
import { MOCK_SHOWS } from '@/lib/mock-data'

export const metadata: Metadata = {
  title: 'Sign In | Clickit Story',
  description: 'Sign in or create a Clickit Story account',
}

const BRAND_COLORS = ['#2C3569', '#9F54A0', '#50A258', '#DB3F34', '#EA8C2E', '#F8C623']

// Use streaming shows for collage (most visually interesting)
const collageShows = MOCK_SHOWS.filter((s) => s.status === 'streaming')

export default function AuthPage() {
  return (
    <div className="-mt-16 flex min-h-screen">
      {/* Left panel — show reel collage (desktop only) */}
      <div className="relative hidden md:flex md:w-1/2 lg:w-3/5 overflow-hidden bg-black">
        {/* Animated show card collage */}
        <ShowCollage shows={collageShows} />

        {/* Edge gradient overlays */}
        <div className="absolute inset-0 bg-gradient-to-r from-transparent to-black/60 pointer-events-none" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent pointer-events-none" />

        {/* Centered overlay content */}
        <div className="absolute inset-0 flex flex-col items-center justify-center px-8 text-center pointer-events-none">
          <Image
            src="/brand/Clickit_final_logo.svg"
            alt="Clickit Story"
            width={140}
            height={40}
            className="h-10 w-auto brightness-0 invert mb-4"
          />
          <p className="text-white/70 text-sm max-w-xs">
            Stream original content from the UAE
          </p>
          {/* 6-color brand strip */}
          <div className="flex gap-1.5 mt-6">
            {BRAND_COLORS.map((color, i) => (
              <div
                key={i}
                className="w-6 h-1 rounded-full"
                style={{ background: color }}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Right panel — glass auth card */}
      <div className="flex flex-1 items-center justify-center bg-[#0A0A0F] px-6 py-12">
        <div
          className="w-full max-w-[400px] rounded-2xl p-8"
          style={{
            background: '#111116',
            border: '1px solid rgba(255,255,255,0.08)',
          }}
        >
          {/* Mobile logo — visible only when left panel is hidden */}
          <div className="flex justify-center mb-6 md:hidden">
            <Image
              src="/brand/Clickit_final_logo.svg"
              alt="Clickit Story"
              width={120}
              height={32}
              className="h-8 w-auto brightness-0 invert"
            />
          </div>

          {/* Heading — Playfair Display */}
          <h2
            className="font-display font-semibold text-white mb-1"
            style={{ fontSize: '1.75rem' }}
          >
            Welcome back
          </h2>
          <p className="text-white/50 text-sm mb-6">
            Sign in to continue watching
          </p>

          <AuthPanel />
        </div>
      </div>
    </div>
  )
}
