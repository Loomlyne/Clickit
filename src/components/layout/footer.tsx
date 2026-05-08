import Image from 'next/image'
import { Link } from '@/i18n/navigation'
import { getAppConfig } from '@/lib/config'

export async function Footer() {
  const { footer } = await getAppConfig()

  return (
    <footer className="relative overflow-hidden border-t border-[var(--line)] bg-[var(--bg-1)]">
      {/* Hero wordmark + contact */}
      <div className="relative border-b border-[var(--line)] px-4 pt-[90px] pb-[60px] sm:px-6 md:px-12">
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
          <p className="font-display m-0 max-w-[420px] text-[16px] leading-relaxed text-[var(--text-dim)] italic">
            {footer.tagline ||
              'A channel for people who still like to watch one thing, all the way through.'}
          </p>
          <div className="w-full max-w-sm">
            <div className="mono mb-3" style={{ letterSpacing: '0.14em' }}>
              Direct contact
            </div>
            <Link
              href="/support#contact-form"
              className="inline-flex min-h-12 w-full items-center justify-center rounded-full border border-[var(--line)] bg-[var(--text)] px-5 text-sm font-semibold text-[var(--bg-0)] transition-colors hover:bg-[var(--accent)]"
            >
              Open contact
            </Link>
          </div>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="mx-auto flex max-w-[1400px] flex-wrap items-center justify-between gap-4 px-4 py-5 sm:px-6 md:px-10">
        <span className="mono text-[12px] text-[var(--text-mute)]">
          © {new Date().getFullYear()} Clickit Story
        </span>
        <div className="mono flex flex-wrap items-center gap-5 text-[12px] text-[var(--text-mute)]">
          <Link
            href="/terms"
            className="transition-colors hover:text-[var(--text)]"
          >
            Terms of Use
          </Link>
          <span aria-hidden>·</span>
          <Link
            href="/privacy"
            className="transition-colors hover:text-[var(--text)]"
          >
            Privacy
          </Link>
          <span aria-hidden>·</span>
          <Link
            href="/support"
            className="transition-colors hover:text-[var(--text)]"
          >
            Support
          </Link>
        </div>
      </div>
    </footer>
  )
}
