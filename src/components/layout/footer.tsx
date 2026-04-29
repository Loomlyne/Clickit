import Image from 'next/image'
import { Link } from '@/i18n/navigation'
import { getAppConfig } from '@/lib/config'

export async function Footer() {
  const { footer } = await getAppConfig()

  return (
    <footer className="relative overflow-hidden border-t border-[var(--line)] bg-[var(--bg-1)]">
      {/* Hero wordmark section */}
      <div className="border-b border-[var(--line)] px-4 pb-[60px] pt-[90px] sm:px-6 md:px-12 relative">
        {/* Eyebrow with accent line */}
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
            className="h-auto w-full max-w-[clamp(280px,58vw,720px)]"
            priority
          />
        </Link>

        {/* Tagline + newsletter */}
        <div className="mt-10 flex flex-col justify-between gap-10 md:flex-row md:items-end">
          <p className="font-display m-0 max-w-[420px] text-[16px] italic leading-relaxed text-[var(--text-dim)]">
            A channel for people who still like to watch one thing, all the way through.
          </p>
          <div className="max-w-sm w-full">
            <div className="mono mb-2" style={{ letterSpacing: '0.14em' }}>The dispatch · weekly, short</div>
            <div className="flex items-center border-b border-[var(--line-2)]">
              <input
                type="email"
                placeholder="your@email.com"
                className="flex-1 bg-transparent py-3 text-sm text-[var(--text)] placeholder:text-[var(--text-mute)] outline-none"
              />
              <button className="flex min-h-11 min-w-11 items-center justify-center px-2 py-3 text-[var(--text-dim)] transition-colors hover:text-[var(--accent)]" aria-label="Submit newsletter signup">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 5-column grid */}
      <div className="grid grid-cols-2 gap-10 border-b border-[var(--line)] px-4 pb-10 pt-12 sm:px-6 lg:grid-cols-[1.2fr_repeat(4,1fr)] lg:gap-12 lg:px-12">
        {/* About column */}
        <div className="col-span-2 lg:col-span-1">
          <h5 className="sr-only">About</h5>
          <Link href="/" className="mb-4 inline-flex min-h-11 items-center" aria-label="Clickit Story home">
            <Image
              src="/brand/Clickit_final_logo.svg"
              alt="Clickit"
              width={136}
              height={56}
              className="h-10 w-auto"
              priority
            />
          </Link>
          <p className="text-[14px] leading-relaxed text-[var(--text-dim)] mb-5">
            A hand-curated streaming home for urban culture, food, design, and travel. No algorithm, no ads — just shows editors stand behind.
          </p>
          {/* Social icons — square, not rounded */}
          <div className="flex items-center gap-2">
            {footer.social?.instagram && (
              <a href={footer.social.instagram} target="_blank" rel="noreferrer" title="Instagram" aria-label="Instagram" className="flex h-11 w-11 items-center justify-center border border-[var(--line)] text-[var(--text-dim)] transition-all duration-150 hover:border-[var(--accent)] hover:text-[var(--accent)] hover:-translate-y-0.5">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.5" cy="6.5" r="1" fill="currentColor" /></svg>
              </a>
            )}
            {footer.social?.x && (
              <a href={footer.social.x} target="_blank" rel="noreferrer" title="X" aria-label="X" className="flex h-11 w-11 items-center justify-center border border-[var(--line)] text-[var(--text-dim)] transition-all duration-150 hover:border-[var(--accent)] hover:text-[var(--accent)] hover:-translate-y-0.5">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M18 3h3l-7.5 8.5L22 21h-6.5l-5-6.5L5 21H2l8-9L2 3h6.5l4.5 6L18 3z" /></svg>
              </a>
            )}
            {footer.social?.youtube && (
              <a href={footer.social.youtube} target="_blank" rel="noreferrer" title="YouTube" aria-label="YouTube" className="flex h-11 w-11 items-center justify-center border border-[var(--line)] text-[var(--text-dim)] transition-all duration-150 hover:border-[var(--accent)] hover:text-[var(--accent)] hover:-translate-y-0.5">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M22 7.5a3 3 0 0 0-2.1-2.1C18 5 12 5 12 5s-6 0-7.9.4A3 3 0 0 0 2 7.5C1.6 9.4 1.6 12 1.6 12s0 2.6.4 4.5a3 3 0 0 0 2.1 2.1C6 19 12 19 12 19s6 0 7.9-.4a3 3 0 0 0 2.1-2.1c.4-1.9.4-4.5.4-4.5s0-2.6-.4-4.5zM10 15V9l5 3-5 3z" /></svg>
              </a>
            )}
          </div>
        </div>

        {/* Watch column */}
        <div>
          <h5 className="mono mb-4 font-medium text-[var(--text-dim)]">Watch</h5>
          <ul className="flex flex-col gap-0.5">
            <li><Link href="/browse" className="inline-flex min-h-11 items-center text-[14px] text-[var(--text)] transition-colors hover:text-[var(--accent)]">Browse all</Link></li>
            <li><Link href="/browse" className="inline-flex min-h-11 items-center text-[14px] text-[var(--text)] transition-colors hover:text-[var(--accent)]">New this week</Link></li>
            <li><Link href="/coming-soon" className="inline-flex min-h-11 items-center text-[14px] text-[var(--text)] transition-colors hover:text-[var(--accent)]">Coming soon</Link></li>
            <li><Link href="/my-list" className="inline-flex min-h-11 items-center text-[14px] text-[var(--text)] transition-colors hover:text-[var(--accent)]">My list</Link></li>
          </ul>
        </div>

        {/* Discover column */}
        <div>
          <h5 className="mono mb-4 font-medium text-[var(--text-dim)]">Discover</h5>
          <ul className="flex flex-col gap-0.5">
            <li><Link href="/browse?genre=Travel" className="inline-flex min-h-11 items-center text-[14px] text-[var(--text)] transition-colors hover:text-[var(--accent)]">Travel</Link></li>
            <li><Link href="/browse?genre=Health" className="inline-flex min-h-11 items-center text-[14px] text-[var(--text)] transition-colors hover:text-[var(--accent)]">Health</Link></li>
            <li><Link href="/browse?genre=Music" className="inline-flex min-h-11 items-center text-[14px] text-[var(--text)] transition-colors hover:text-[var(--accent)]">Music</Link></li>
            <li><Link href="/browse?genre=Comedy" className="inline-flex min-h-11 items-center text-[14px] text-[var(--text)] transition-colors hover:text-[var(--accent)]">Comedy</Link></li>
            <li><Link href="/browse?genre=Tech" className="inline-flex min-h-11 items-center text-[14px] text-[var(--text)] transition-colors hover:text-[var(--accent)]">Tech</Link></li>
          </ul>
        </div>

        {/* Company column */}
        <div>
          <h5 className="mono mb-4 font-medium text-[var(--text-dim)]">Company</h5>
          <ul className="flex flex-col gap-0.5">
            <li><span className="inline-flex min-h-11 cursor-pointer items-center text-[14px] text-[var(--text)] transition-colors hover:text-[var(--accent)]">About</span></li>
            <li><span className="inline-flex min-h-11 cursor-pointer items-center text-[14px] text-[var(--text)] transition-colors hover:text-[var(--accent)]">Creators</span></li>
            <li><span className="inline-flex min-h-11 cursor-pointer items-center text-[14px] text-[var(--text)] transition-colors hover:text-[var(--accent)]">Press</span></li>
            <li><Link href="/support" className="inline-flex min-h-11 items-center text-[14px] text-[var(--text)] transition-colors hover:text-[var(--accent)]">Help &amp; support</Link></li>
          </ul>
        </div>

        {/* Account column */}
        <div>
          <h5 className="mono mb-4 font-medium text-[var(--text-dim)]">Account</h5>
          <ul className="flex flex-col gap-0.5">
            <li><Link href="/profile" className="inline-flex min-h-11 items-center text-[14px] text-[var(--text)] transition-colors hover:text-[var(--accent)]">Profile</Link></li>
            <li><Link href="/profile" className="inline-flex min-h-11 items-center text-[14px] text-[var(--text)] transition-colors hover:text-[var(--accent)]">Settings</Link></li>
            <li><Link href="/auth" className="inline-flex min-h-11 items-center text-[14px] text-[var(--text)] transition-colors hover:text-[var(--accent)]">Sign in</Link></li>
          </ul>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="px-4 py-6 sm:px-6 md:px-12">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-wrap items-center gap-4 mono text-[var(--text-mute)]">
            <span>&copy; {new Date().getFullYear()} Clickit Story</span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              All systems streaming
            </span>
            {footer.legal?.terms && <a href={footer.legal.terms} className="inline-flex min-h-11 items-center transition-colors hover:text-[var(--text)]">Terms</a>}
            {footer.legal?.privacy && <a href={footer.legal.privacy} className="inline-flex min-h-11 items-center transition-colors hover:text-[var(--text)]">Privacy</a>}
            {footer.legal?.cookies && <a href={footer.legal.cookies} className="inline-flex min-h-11 items-center transition-colors hover:text-[var(--text)]">Cookies</a>}
          </div>
          <div className="flex items-center gap-4 mono text-[var(--text-mute)]">
            <span>EN · UAE</span>
            <span>Made between cities</span>
          </div>
        </div>
      </div>
    </footer>
  )
}
