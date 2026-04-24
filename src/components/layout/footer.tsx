import { getLocale } from 'next-intl/server'
import Image from 'next/image'
import { Link } from '@/i18n/navigation'
import { getAppConfig } from '@/lib/config'

export async function Footer() {
  const [{ footer }, locale] = await Promise.all([
    getAppConfig(),
    getLocale(),
  ])

  return (
    <footer className="border-t border-[var(--line)] bg-[var(--bg-1)]">
      {/* Hero wordmark section */}
      <div className="mx-auto max-w-[1400px] px-10 pt-20 pb-16">
        <div className="flex flex-col gap-8 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="mono mb-4">Est. 2026 · Streaming the city</div>
            <h2 className="font-[family-name:var(--font-display)] text-[clamp(64px,8vw,120px)] font-normal leading-[0.85] tracking-[-0.03em]">
              Click<em className="italic">it.</em>
            </h2>
          </div>
          <div className="max-w-md">
            <p className="text-[15px] leading-relaxed text-[var(--text-dim)] italic font-[family-name:var(--font-display)] mb-6">
              A channel for people who still like to watch one thing, all the way through.
            </p>
            {/* Newsletter signup */}
            <div>
              <div className="mono mb-2">The dispatch · weekly, short</div>
              <div className="flex items-center gap-0 rounded border border-[var(--line)] bg-[var(--bg-0)]">
                <input
                  type="email"
                  placeholder="your@email.com"
                  className="flex-1 bg-transparent px-3 py-2.5 text-sm text-[var(--text)] placeholder:text-[var(--text-mute)] outline-none"
                />
                <button className="flex items-center justify-center px-3 py-2.5 text-[var(--text-dim)] transition-colors hover:text-[var(--text)]">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 5-column navigation grid */}
      <div className="mx-auto max-w-[1400px] px-10 pb-16">
        <div className="grid grid-cols-2 gap-10 md:grid-cols-5">
          {/* About column */}
          <div className="col-span-2 md:col-span-1">
            <Link href="/" className="mb-4 block" aria-label="Clickit Story home">
              <Image
                src="/brand/Clickit_final_logo.svg"
                alt="Clickit Story"
                width={120}
                height={30}
                className="h-6 w-auto"
              />
            </Link>
            <p className="text-[13px] leading-relaxed text-[var(--text-dim)] mb-5">
              A hand-curated streaming home for urban culture, food, design, and travel. No algorithm, no ads.
            </p>
            {/* Social icons */}
            <div className="flex items-center gap-2">
              {footer.social?.instagram && (
                <a href={footer.social.instagram} target="_blank" rel="noreferrer" title="Instagram" className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--line)] text-[var(--text-mute)] transition-colors hover:border-[var(--line-2)] hover:text-[var(--text)]">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.5" cy="6.5" r="1" fill="currentColor" /></svg>
                </a>
              )}
              {footer.social?.x && (
                <a href={footer.social.x} target="_blank" rel="noreferrer" title="X" className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--line)] text-[var(--text-mute)] transition-colors hover:border-[var(--line-2)] hover:text-[var(--text)]">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M18 3h3l-7.5 8.5L22 21h-6.5l-5-6.5L5 21H2l8-9L2 3h6.5l4.5 6L18 3z" /></svg>
                </a>
              )}
              {footer.social?.youtube && (
                <a href={footer.social.youtube} target="_blank" rel="noreferrer" title="YouTube" className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--line)] text-[var(--text-mute)] transition-colors hover:border-[var(--line-2)] hover:text-[var(--text)]">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M22 7.5a3 3 0 0 0-2.1-2.1C18 5 12 5 12 5s-6 0-7.9.4A3 3 0 0 0 2 7.5C1.6 9.4 1.6 12 1.6 12s0 2.6.4 4.5a3 3 0 0 0 2.1 2.1C6 19 12 19 12 19s6 0 7.9-.4a3 3 0 0 0 2.1-2.1c.4-1.9.4-4.5.4-4.5s0-2.6-.4-4.5zM10 15V9l5 3-5 3z" /></svg>
                </a>
              )}
            </div>
          </div>

          {/* Watch column */}
          <div>
            <h5 className="mono mb-4 text-[var(--text-dim)]">Watch</h5>
            <ul className="space-y-2.5">
              <li><Link href="/browse" className="text-sm text-[var(--text-dim)] transition-colors hover:text-[var(--text)]">Browse all</Link></li>
              <li><Link href="/browse" className="text-sm text-[var(--text-dim)] transition-colors hover:text-[var(--text)]">New this week</Link></li>
              <li><Link href="/coming-soon" className="text-sm text-[var(--text-dim)] transition-colors hover:text-[var(--text)]">Coming soon</Link></li>
              <li><Link href="/my-list" className="text-sm text-[var(--text-dim)] transition-colors hover:text-[var(--text)]">My list</Link></li>
            </ul>
          </div>

          {/* Discover column */}
          <div>
            <h5 className="mono mb-4 text-[var(--text-dim)]">Discover</h5>
            <ul className="space-y-2.5">
              <li><Link href="/browse?genre=Travel" className="text-sm text-[var(--text-dim)] transition-colors hover:text-[var(--text)]">Travel</Link></li>
              <li><Link href="/browse?genre=Health" className="text-sm text-[var(--text-dim)] transition-colors hover:text-[var(--text)]">Health</Link></li>
              <li><Link href="/browse?genre=Music" className="text-sm text-[var(--text-dim)] transition-colors hover:text-[var(--text)]">Music</Link></li>
              <li><Link href="/browse?genre=Comedy" className="text-sm text-[var(--text-dim)] transition-colors hover:text-[var(--text)]">Comedy</Link></li>
              <li><Link href="/browse?genre=Tech" className="text-sm text-[var(--text-dim)] transition-colors hover:text-[var(--text)]">Tech</Link></li>
            </ul>
          </div>

          {/* Company column */}
          <div>
            <h5 className="mono mb-4 text-[var(--text-dim)]">Company</h5>
            <ul className="space-y-2.5">
              <li><span className="text-sm text-[var(--text-dim)]">About</span></li>
              <li><span className="text-sm text-[var(--text-dim)]">Creators</span></li>
              <li><span className="text-sm text-[var(--text-dim)]">Press</span></li>
              <li><Link href="/support" className="text-sm text-[var(--text-dim)] transition-colors hover:text-[var(--text)]">Help &amp; support</Link></li>
            </ul>
          </div>

          {/* Account column */}
          <div>
            <h5 className="mono mb-4 text-[var(--text-dim)]">Account</h5>
            <ul className="space-y-2.5">
              <li><Link href="/profile" className="text-sm text-[var(--text-dim)] transition-colors hover:text-[var(--text)]">Profile</Link></li>
              <li><Link href="/profile" className="text-sm text-[var(--text-dim)] transition-colors hover:text-[var(--text)]">Settings</Link></li>
              <li><Link href="/auth" className="text-sm text-[var(--text-dim)] transition-colors hover:text-[var(--text)]">Sign in</Link></li>
            </ul>
          </div>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="border-t border-[var(--line)] mx-auto max-w-[1400px] px-10 py-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-wrap items-center gap-4 font-[family-name:var(--font-mono)] text-[11px] tracking-[0.1em] uppercase text-[var(--text-mute)]">
            <span>&copy; {new Date().getFullYear()} Clickit Story</span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              All systems streaming
            </span>
            {footer.legal?.privacy && <a href={footer.legal.privacy} className="hover:text-[var(--text)]">Privacy</a>}
            {footer.legal?.terms && <a href={footer.legal.terms} className="hover:text-[var(--text)]">Terms</a>}
            {footer.legal?.cookies && <a href={footer.legal.cookies} className="hover:text-[var(--text)]">Cookies</a>}
          </div>
          <div className="flex items-center gap-4 font-[family-name:var(--font-mono)] text-[11px] tracking-[0.1em] uppercase text-[var(--text-mute)]">
            <span>EN · UAE</span>
            <span>Made between cities</span>
          </div>
        </div>
      </div>
    </footer>
  )
}
