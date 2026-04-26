import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'

import Image from 'next/image'
import { Link } from '@/i18n/navigation'
import { AuthPanel } from '@/components/auth/auth-panel'
import { BotIdInit } from '@/components/auth/botid-init'
import { getFeaturedShows } from '@/lib/queries'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('common')
  return {
    title: `${t('signIn')} | Clickit Story`,
    description: t('tagline'),
  }
}

export default async function AuthPage() {
  const shows = await getFeaturedShows()
  const backdrop = shows[1]?.heroImageUrl || shows[0]?.posterUrl

  return (
    <div className="-mt-16 relative flex min-h-[calc(100dvh-4rem)] overflow-hidden">
      <BotIdInit />

      {/* LEFT — editorial hero */}
      <div className="relative hidden w-1/2 overflow-hidden lg:block">
        {backdrop && (
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: `url(${backdrop})`, animation: 'heroZoom 40s ease-out infinite alternate' }}
          />
        )}
        <div className="absolute inset-0 bg-black/18" />
        <div className="absolute inset-0 bg-gradient-to-r from-black/72 via-black/46 to-black/72" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/86 via-black/26 to-transparent" />

        <div className="relative flex h-full w-full flex-col justify-between p-12">
          {/* Top: logo + badge */}
          <div className="flex items-center justify-between">
            <Image
              src="/brand/Clickit_final_logo.svg"
              alt="Clickit Story"
              width={120}
              height={30}
              className="h-7 w-auto"
            />
            <span className="mono text-[10px] text-white/50">Beta · Invite open</span>
          </div>

          {/* Middle: quote */}
          <div className="max-w-md">
            <div className="mono text-[10px] text-[var(--primary)] mb-4">◆ Why people watch</div>
            <h2 className="font-[family-name:var(--font-display)] text-[32px] font-normal leading-[1.15] tracking-[-0.01em] text-white mb-4">
              &ldquo;Finally, a place where <em className="italic">one thing</em> plays all the way through — no &apos;because you watched&apos;, no &apos;skip in 5&apos;.&rdquo;
            </h2>
            <div className="mono text-[11px] text-white/40">— Early beta subscriber</div>

            {/* Stats */}
            <div className="flex gap-8 mt-10">
              <div>
                <div className="font-[family-name:var(--font-display)] text-2xl text-white">15</div>
                <div className="mono text-[10px] text-white/40">Original<br />shows</div>
              </div>
              <div>
                <div className="font-[family-name:var(--font-display)] text-2xl text-white">UAE</div>
                <div className="mono text-[10px] text-white/40">Abu Dhabi<br />produced</div>
              </div>
              <div>
                <div className="font-[family-name:var(--font-display)] text-2xl text-white">0</div>
                <div className="mono text-[10px] text-white/40">Ads.<br />Ever.</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* RIGHT — form */}
      <div className="flex w-full items-center justify-center bg-[var(--bg-0)] px-5 py-8 sm:px-6 md:py-12 lg:w-1/2 lg:py-16">
        <div className="w-full max-w-[420px]">
          <h1 className="font-[family-name:var(--font-display)] text-[32px] font-normal tracking-[-0.01em] mb-2 md:text-[36px]">
            Welcome <em className="italic">back.</em>
          </h1>
          <p className="mb-6 text-[15px] text-[var(--text-dim)] md:mb-8">
            Pick up where you left off. New here? Sign up below.
          </p>

          <AuthPanel />

          <div className="mt-4 text-center md:mt-6">
            <Link
              href="/browse"
              className="inline-flex min-h-11 items-center text-[13px] font-[family-name:var(--font-mono)] tracking-[0.08em] uppercase text-[var(--text-mute)] hover:text-[var(--text)] transition-colors"
            >
              Skip sign in →
            </Link>
          </div>

          <div className="mt-6 flex items-center justify-between text-[11px] font-[family-name:var(--font-mono)] tracking-[0.1em] uppercase text-[var(--text-mute)] md:mt-8">
            <span>◆ End-to-end encrypted</span>
            <span>v2.0 · Beta</span>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes heroZoom {
          from { transform: scale(1); }
          to { transform: scale(1.06); }
        }
      `}</style>
    </div>
  )
}
