import Image from 'next/image'
import { Link } from '@/i18n/navigation'
import { getAppConfig } from '@/lib/config'
import { NewsletterSignupForm } from '@/components/layout/newsletter-signup-form'

export async function Footer() {
  const { footer } = await getAppConfig()

  return (
    <footer className="relative overflow-hidden border-t border-[var(--line)] bg-[var(--bg-1)]">
      {/* Hero wordmark + newsletter */}
      <div className="border-b border-[var(--line)] px-4 pb-[60px] pt-[90px] sm:px-6 md:px-12 relative">
        <div className="mono mb-[18px] flex items-center gap-2.5" style={{ color: 'var(--accent)', letterSpacing: '0.22em' }}>
          <span className="inline-block h-px w-6 bg-[var(--accent)]" />
          Est. 2026 · Streaming the city
        </div>

        <Link href="/" aria-label="Clickit Story home" className="block">
          <Image
            src="/brand/Clickit_final_logo.svg"
            alt="Clickit"
            width={486}
            height={199}
            className="h-auto w-full max-w-[clamp(200px,42vw,520px)]"
            priority
          />
        </Link>

        <div className="mt-10 flex flex-col justify-between gap-10 md:flex-row md:items-end">
          <p className="font-display m-0 max-w-[420px] text-[16px] italic leading-relaxed text-[var(--text-dim)]">
            {footer.tagline || 'A channel for people who still like to watch one thing, all the way through.'}
          </p>
          <div className="max-w-sm w-full">
            <div className="mono mb-2" style={{ letterSpacing: '0.14em' }}>The dispatch, weekly, short</div>
            <NewsletterSignupForm source="footer" />
          </div>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="mx-auto flex max-w-[1400px] flex-wrap items-center justify-between gap-4 px-4 py-5 sm:px-6 md:px-10">
        <span className="mono text-[12px] text-[var(--text-mute)]">
          © {new Date().getFullYear()} Clickit Story
        </span>
        <div className="mono flex items-center gap-5 text-[12px] text-[var(--text-mute)]">
          <Link href="/terms" className="transition-colors hover:text-[var(--text)]">Terms of Use</Link>
          <span aria-hidden>·</span>
          <Link href="/privacy" className="transition-colors hover:text-[var(--text)]">Privacy</Link>
          <span aria-hidden>·</span>
          <Link href="/support" className="transition-colors hover:text-[var(--text)]">Support</Link>
        </div>
      </div>
    </footer>
  )
}
