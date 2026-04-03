import Link from 'next/link'
import Image from 'next/image'

const BRAND_COLORS = ['#2C3569', '#9F54A0', '#50A258', '#DB3F34', '#EA8C2E', '#F8C623']

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

export function Footer() {
  return (
    <footer className="bg-black border-t border-white/[0.06]">
      <div className="mx-auto max-w-7xl px-6 py-16 md:px-12">
        <div className="flex flex-col gap-12 lg:flex-row lg:justify-between">

          {/* Brand block */}
          <div className="flex flex-col gap-6 lg:max-w-xs">
            <Image
              src="/brand/Clickit_final_logo.svg"
              alt="Clickit Story"
              width={140}
              height={36}
              className="h-9 w-auto"
            />
            <p className="text-sm text-white/45 leading-relaxed max-w-[220px]">
              Original shows from the UAE.<br />
              Produced by Spacelight Studios FZ LLC.
            </p>
            <div className="flex gap-3">
              <a href="#" aria-label="YouTube" className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border border-white/10 text-white/40 transition-colors hover:border-white/30 hover:text-white">
                <YouTubeIcon className="h-4 w-4" />
              </a>
              <a href="#" aria-label="Instagram" className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border border-white/10 text-white/40 transition-colors hover:border-white/30 hover:text-white">
                <InstagramIcon className="h-4 w-4" />
              </a>
              <a href="#" aria-label="X (Twitter)" className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border border-white/10 text-white/40 transition-colors hover:border-white/30 hover:text-white">
                <XIcon className="h-4 w-4" />
              </a>
            </div>
          </div>

          {/* Link columns */}
          <div className="grid grid-cols-2 gap-8 sm:grid-cols-4">
            <div>
              <h4 className="mb-4 text-xs font-semibold uppercase tracking-wider text-white/55">Navigate</h4>
              <ul className="space-y-3">
                <li><Link href="/" className="text-sm text-white/40 transition-colors hover:text-white">Home</Link></li>
                <li><Link href="/coming-soon" className="text-sm text-white/40 transition-colors hover:text-white">Coming Soon</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="mb-4 text-xs font-semibold uppercase tracking-wider text-white/55">Shows</h4>
              <ul className="space-y-3">
                <li><Link href="/series?genre=Entertainment" className="text-sm text-white/40 transition-colors hover:text-white">Entertainment</Link></li>
                <li><Link href="/series?genre=Documentary" className="text-sm text-white/40 transition-colors hover:text-white">Documentary</Link></li>
                <li><Link href="/series?genre=Health" className="text-sm text-white/40 transition-colors hover:text-white">Health</Link></li>
                <li><Link href="/series?genre=Tech" className="text-sm text-white/40 transition-colors hover:text-white">Tech</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="mb-4 text-xs font-semibold uppercase tracking-wider text-white/55">Support</h4>
              <ul className="space-y-3">
                <li><Link href="/support" className="text-sm text-white/40 transition-colors hover:text-white">Contact Us</Link></li>
                <li><Link href="/support#faq" className="text-sm text-white/40 transition-colors hover:text-white">FAQ</Link></li>
                <li><Link href="/auth" className="text-sm text-white/40 transition-colors hover:text-white">Sign In</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="mb-4 text-xs font-semibold uppercase tracking-wider text-white/55">Legal</h4>
              <ul className="space-y-3">
                <li><Link href="#" className="text-sm text-white/40 transition-colors hover:text-white">Privacy Policy</Link></li>
                <li><Link href="#" className="text-sm text-white/40 transition-colors hover:text-white">Terms of Service</Link></li>
              </ul>
            </div>
          </div>
        </div>

        {/* Copyright */}
        <div className="mt-12 border-t border-white/[0.06] pt-8">
          <p className="text-xs text-white/25">
            &copy; {new Date().getFullYear()} Clickit Story · All rights reserved
          </p>
        </div>
      </div>

      {/* Brand color strip */}
      <div className="flex h-1" aria-hidden="true">
        {BRAND_COLORS.map((color) => (
          <div key={color} className="flex-1" style={{ background: color }} />
        ))}
      </div>
    </footer>
  )
}
