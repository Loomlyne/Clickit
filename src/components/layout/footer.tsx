import Link from 'next/link'
import Image from 'next/image'
import { getAppConfig } from '@/lib/config'

const BRAND_COLORS = ['#2C3569', '#9F54A0', '#50A258', '#DB3F34', '#EA8C2E', '#F8C623']

const GENRE_LINKS = [
  { label: 'Travel', href: '/browse?genre=Travel' },
  { label: 'Health', href: '/browse?genre=Health' },
  { label: 'Music', href: '/browse?genre=Music' },
  { label: 'Comedy', href: '/browse?genre=Comedy' },
  { label: 'Tech', href: '/browse?genre=Tech' },
]

// Renders a social icon link when a URL is set; returns null for empty slots
// so the footer doesn't render dead href="#" placeholders.
function SocialLink({
  href,
  label,
  children,
}: {
  href: string
  label: string
  children: React.ReactNode
}) {
  if (!href) return null
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      aria-label={label}
      className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-full border border-white/10 bg-white/[0.03] text-white/48 transition-colors hover:border-white/20 hover:text-white"
    >
      {children}
    </a>
  )
}

function YouTubeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
    </svg>
  )
}

function InstagramIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
    </svg>
  )
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  )
}

export async function Footer() {
  const { footer } = await getAppConfig()

  return (
    <footer className="relative mt-24 border-t border-white/[0.06] bg-[#07090d]">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/12 to-transparent" />
      <div className="mx-auto max-w-7xl px-6 py-16 md:px-12">
        <div className="grid gap-10 lg:grid-cols-[1.4fr_1fr]">
          {/* Brand panel */}
          <div className="rounded-[28px] border border-white/10 bg-white/[0.03] p-8 shadow-[0_24px_80px_rgba(0,0,0,0.22)] backdrop-blur-md">
            <div className="flex flex-col gap-5">
              <Image
                src="/brand/Clickit_final_logo.svg"
                alt="Clickit Story"
                width={156}
                height={36}
                className="h-9 w-auto"
              />
              <p className="text-base leading-7 text-white/66">{footer.tagline}</p>
              <div className="flex flex-wrap items-center gap-3 text-sm text-white/48">
                {footer.stat && (
                  <span className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5">
                    {footer.stat}
                  </span>
                )}
                <SocialLink href={footer.social.instagram} label="Instagram">
                  <InstagramIcon className="h-4 w-4" />
                </SocialLink>
                <SocialLink href={footer.social.x} label="X (Twitter)">
                  <XIcon className="h-4 w-4" />
                </SocialLink>
                <SocialLink href={footer.social.youtube} label="YouTube">
                  <YouTubeIcon className="h-4 w-4" />
                </SocialLink>
                {footer.contactEmail && (
                  <a
                    href={`mailto:${footer.contactEmail}`}
                    className="text-xs font-medium text-white/48 transition-colors hover:text-white"
                  >
                    {footer.contactEmail}
                  </a>
                )}
              </div>
            </div>
          </div>

          {/* Nav columns */}
          <div className="grid grid-cols-3 gap-8">
            <div>
              <h4 className="mb-4 text-[11px] font-semibold uppercase tracking-[0.24em] text-white/60">Navigate</h4>
              <ul className="space-y-3">
                <li><Link href="/browse" className="text-sm text-white/56 transition-colors hover:text-white">Browse</Link></li>
                <li><Link href="/coming-soon" className="text-sm text-white/56 transition-colors hover:text-white">Coming Soon</Link></li>
                <li><Link href="/support" className="text-sm text-white/56 transition-colors hover:text-white">Support</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="mb-4 text-[11px] font-semibold uppercase tracking-[0.24em] text-white/60">Genres</h4>
              <ul className="space-y-3">
                {GENRE_LINKS.map(({ label, href }) => (
                  <li key={label}>
                    <Link href={href} className="text-sm text-white/56 transition-colors hover:text-white">{label}</Link>
                  </li>
                ))}
              </ul>
            </div>
            <div className="space-y-8">
              <div>
                <h4 className="mb-4 text-[11px] font-semibold uppercase tracking-[0.24em] text-white/60">Account</h4>
                <ul className="space-y-3">
                  <li><Link href="/auth" className="text-sm text-white/56 transition-colors hover:text-white">Sign In</Link></li>
                  <li><Link href="/my-list" className="text-sm text-white/56 transition-colors hover:text-white">My List</Link></li>
                  <li><Link href="/profile" className="text-sm text-white/56 transition-colors hover:text-white">Profile</Link></li>
                </ul>
              </div>
              <div>
                <h4 className="mb-4 text-[11px] font-semibold uppercase tracking-[0.24em] text-white/60">Legal</h4>
                <ul className="space-y-3">
                  {footer.legal.privacy && (
                    <li>
                      <Link
                        href={footer.legal.privacy}
                        className="text-sm text-white/56 transition-colors hover:text-white"
                      >
                        Privacy Policy
                      </Link>
                    </li>
                  )}
                  {footer.legal.terms && (
                    <li>
                      <Link
                        href={footer.legal.terms}
                        className="text-sm text-white/56 transition-colors hover:text-white"
                      >
                        Terms of Service
                      </Link>
                    </li>
                  )}
                  {footer.legal.cookies && (
                    <li>
                      <Link
                        href={footer.legal.cookies}
                        className="text-sm text-white/56 transition-colors hover:text-white"
                      >
                        Cookie Policy
                      </Link>
                    </li>
                  )}
                </ul>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-12 flex flex-col gap-2 border-t border-white/[0.06] pt-8 text-xs text-white/50 md:flex-row md:items-center md:justify-between">
          <p>&copy; {new Date().getFullYear()} Clickit Story. All rights reserved.</p>
          <p>A Spacelight Studios FZ LLC production · Abu Dhabi, UAE</p>
        </div>
      </div>

      <div className="flex h-1" aria-hidden="true">
        {BRAND_COLORS.map((color) => (
          <div key={color} className="flex-1" style={{ background: color }} />
        ))}
      </div>
    </footer>
  )
}
