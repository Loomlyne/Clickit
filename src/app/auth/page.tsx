import type { Metadata } from 'next'
import Image from 'next/image'
import { AuthPanel } from '@/components/auth/auth-panel'

export const metadata: Metadata = {
  title: 'Sign In | Clickit Story',
  description: 'Sign in or create a Clickit Story account',
}

const COLLAGE_COLORS = [
  'bg-brand-blue', 'bg-brand-purple', 'bg-brand-green',
  'bg-brand-red', 'bg-brand-orange', 'bg-brand-yellow',
  'bg-brand-purple', 'bg-brand-blue', 'bg-brand-green',
  'bg-brand-orange', 'bg-brand-red', 'bg-brand-yellow',
] as const

export default function AuthPage() {
  return (
    <div className="-mt-16 flex min-h-screen">
      {/* Left: cinematic collage (hidden on mobile) */}
      <div className="relative hidden lg:flex lg:w-1/2">
        <div className="absolute inset-0 grid grid-cols-3 grid-rows-4 gap-1 opacity-30">
          {COLLAGE_COLORS.map((color, i) => (
            <div key={i} className={color} />
          ))}
        </div>
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm">
          <Image
            src="/brand/Clickit_final_logo.svg"
            alt="Clickit Story"
            width={180}
            height={48}
            className="h-12 w-auto"
          />
          <p className="mt-4 text-lg text-white/60">Stream original content from the UAE</p>
        </div>
      </div>

      {/* Right: form panel */}
      <div className="flex flex-1 items-center justify-center bg-background px-6 py-12">
        <div className="w-full max-w-md">
          <Image
            src="/brand/Clickit_final_logo.svg"
            alt="Clickit Story"
            width={120}
            height={32}
            className="mb-8 h-8 w-auto lg:hidden"
          />
          <AuthPanel />
        </div>
      </div>
    </div>
  )
}
