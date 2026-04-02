import Link from 'next/link'
import Image from 'next/image'

const BRAND_COLORS = ['#2C3569', '#9F54A0', '#50A258', '#DB3F34', '#EA8C2E', '#F8C623']

// YouTube SVG icon
function YouTubeIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
    </svg>
  )
}

// Instagram SVG icon
function InstagramIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
    </svg>
  )
}

// X (Twitter) SVG icon
function XIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  )
}

export function Footer() {
  return (
    <footer className="bg-[#080808] border-t border-white/[0.06]">
      <div className="mx-auto max-w-7xl px-6 py-12 md:px-12">
        {/* Logo + tagline */}
        <div className="flex items-center gap-3 mb-8">
          <Image
            src="/brand/Clickit_final_logo.svg"
            alt="Clickit Story"
            width={100}
            height={28}
            className="h-7 w-auto"
          />
          <p className="text-sm text-white/40">Original shows from the UAE</p>
        </div>

        {/* 6-column grid */}
        <div className="grid grid-cols-2 gap-8 md:grid-cols-3 lg:grid-cols-6">
          {/* Column 1: Navigate */}
          <div>
            <h4 className="text-xs font-semibold text-white/60 uppercase tracking-wider">Navigate</h4>
            <ul className="mt-3 space-y-2">
              <li><Link href="/" className="text-sm text-white/40 transition-colors hover:text-white">Home</Link></li>
              <li><Link href="/series" className="text-sm text-white/40 transition-colors hover:text-white">Browse</Link></li>
              <li><Link href="/coming-soon" className="text-sm text-white/40 transition-colors hover:text-white">Coming Soon</Link></li>
            </ul>
          </div>
          {/* Column 2: Shows */}
          <div>
            <h4 className="text-xs font-semibold text-white/60 uppercase tracking-wider">Shows</h4>
            <ul className="mt-3 space-y-2">
              <li><Link href="/series?genre=Entertainment" className="text-sm text-white/40 transition-colors hover:text-white">Entertainment</Link></li>
              <li><Link href="/series?genre=Documentary" className="text-sm text-white/40 transition-colors hover:text-white">Documentary</Link></li>
              <li><Link href="/series?genre=Health" className="text-sm text-white/40 transition-colors hover:text-white">Health</Link></li>
              <li><Link href="/series?genre=Tech" className="text-sm text-white/40 transition-colors hover:text-white">Tech</Link></li>
            </ul>
          </div>
          {/* Column 3: Support */}
          <div>
            <h4 className="text-xs font-semibold text-white/60 uppercase tracking-wider">Support</h4>
            <ul className="mt-3 space-y-2">
              <li><Link href="/support" className="text-sm text-white/40 transition-colors hover:text-white">Contact Us</Link></li>
              <li><Link href="/support#faq" className="text-sm text-white/40 transition-colors hover:text-white">FAQ</Link></li>
            </ul>
          </div>
          {/* Column 4: Account */}
          <div>
            <h4 className="text-xs font-semibold text-white/60 uppercase tracking-wider">Account</h4>
            <ul className="mt-3 space-y-2">
              <li><Link href="/auth" className="text-sm text-white/40 transition-colors hover:text-white">Sign In</Link></li>
              <li><Link href="#" className="text-sm text-white/40 transition-colors hover:text-white">Manage Profile</Link></li>
            </ul>
          </div>
          {/* Column 5: Connect */}
          <div>
            <h4 className="text-xs font-semibold text-white/60 uppercase tracking-wider">Connect</h4>
            <div className="flex gap-3 mt-3">
              <a href="#" aria-label="YouTube" className="text-white/40 hover:text-white transition-colors">
                <YouTubeIcon className="w-5 h-5" />
              </a>
              <a href="#" aria-label="Instagram" className="text-white/40 hover:text-white transition-colors">
                <InstagramIcon className="w-5 h-5" />
              </a>
              <a href="#" aria-label="X (Twitter)" className="text-white/40 hover:text-white transition-colors">
                <XIcon className="w-5 h-5" />
              </a>
            </div>
          </div>
          {/* Column 6: Legal */}
          <div>
            <h4 className="text-xs font-semibold text-white/60 uppercase tracking-wider">Legal</h4>
            <ul className="mt-3 space-y-2">
              <li><Link href="#" className="text-sm text-white/40 transition-colors hover:text-white">Privacy Policy</Link></li>
              <li><Link href="#" className="text-sm text-white/40 transition-colors hover:text-white">Terms of Service</Link></li>
            </ul>
          </div>
        </div>

        {/* Copyright */}
        <p className="mt-10 text-xs text-white/30">
          &copy; {new Date().getFullYear()} Clickit Story. Produced by Spacelight Studios FZ LLC.
        </p>
      </div>

      {/* Brand color strip at very bottom */}
      <div className="h-px flex border-t border-white/[0.06]" aria-hidden="true" />
      <div className="h-0.5 flex" aria-hidden="true">
        {BRAND_COLORS.map((color) => (
          <div key={color} className="flex-1" style={{ background: color }} />
        ))}
      </div>
    </footer>
  )
}
