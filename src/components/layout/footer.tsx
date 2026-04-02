import Link from 'next/link'

export function Footer() {
  return (
    <footer className="border-t border-border bg-surface-1 px-6 py-12 md:px-12">
      <div className="mx-auto max-w-7xl">
        {/* Logo + tagline */}
        <div className="flex items-center gap-3">
          <img src="/brand/Clickit_final_logo.svg" alt="Clickit Story" className="h-6 w-auto" />
          <p className="text-sm text-muted-foreground">Original shows from the UAE</p>
        </div>

        {/* 6-column grid */}
        <div className="mt-8 grid grid-cols-2 gap-8 md:grid-cols-3 lg:grid-cols-6">
          {/* Column 1: Navigate */}
          <div>
            <h4 className="text-sm font-semibold text-foreground">Navigate</h4>
            <ul className="mt-3 space-y-2">
              <li><Link href="/" className="text-sm text-muted-foreground transition-colors hover:text-foreground">Home</Link></li>
              <li><Link href="/series" className="text-sm text-muted-foreground transition-colors hover:text-foreground">Browse</Link></li>
              <li><Link href="/coming-soon" className="text-sm text-muted-foreground transition-colors hover:text-foreground">Coming Soon</Link></li>
            </ul>
          </div>
          {/* Column 2: Shows */}
          <div>
            <h4 className="text-sm font-semibold text-foreground">Shows</h4>
            <ul className="mt-3 space-y-2">
              <li><Link href="/series?genre=Entertainment" className="text-sm text-muted-foreground transition-colors hover:text-foreground">Entertainment</Link></li>
              <li><Link href="/series?genre=Documentary" className="text-sm text-muted-foreground transition-colors hover:text-foreground">Documentary</Link></li>
              <li><Link href="/series?genre=Health" className="text-sm text-muted-foreground transition-colors hover:text-foreground">Health</Link></li>
              <li><Link href="/series?genre=Tech" className="text-sm text-muted-foreground transition-colors hover:text-foreground">Tech</Link></li>
            </ul>
          </div>
          {/* Column 3: Support */}
          <div>
            <h4 className="text-sm font-semibold text-foreground">Support</h4>
            <ul className="mt-3 space-y-2">
              <li><Link href="/support" className="text-sm text-muted-foreground transition-colors hover:text-foreground">Contact Us</Link></li>
              <li><Link href="/support#faq" className="text-sm text-muted-foreground transition-colors hover:text-foreground">FAQ</Link></li>
            </ul>
          </div>
          {/* Column 4: Account */}
          <div>
            <h4 className="text-sm font-semibold text-foreground">Account</h4>
            <ul className="mt-3 space-y-2">
              <li><Link href="/auth" className="text-sm text-muted-foreground transition-colors hover:text-foreground">Sign In</Link></li>
              <li><Link href="#" className="text-sm text-muted-foreground transition-colors hover:text-foreground">Manage Subscription</Link></li>
            </ul>
          </div>
          {/* Column 5: Connect */}
          <div>
            <h4 className="text-sm font-semibold text-foreground">Connect</h4>
            <ul className="mt-3 space-y-2">
              <li><a href="#" className="text-sm text-muted-foreground transition-colors hover:text-foreground">YouTube</a></li>
              <li><a href="#" className="text-sm text-muted-foreground transition-colors hover:text-foreground">Instagram</a></li>
              <li><a href="#" className="text-sm text-muted-foreground transition-colors hover:text-foreground">Twitter</a></li>
            </ul>
          </div>
          {/* Column 6: Legal */}
          <div>
            <h4 className="text-sm font-semibold text-foreground">Legal</h4>
            <ul className="mt-3 space-y-2">
              <li><Link href="#" className="text-sm text-muted-foreground transition-colors hover:text-foreground">Privacy Policy</Link></li>
              <li><Link href="#" className="text-sm text-muted-foreground transition-colors hover:text-foreground">Terms of Service</Link></li>
            </ul>
          </div>
        </div>

        {/* Copyright */}
        <p className="mt-10 text-xs text-text-muted">
          &copy; {new Date().getFullYear()} Clickit Story. Produced by Spacelight Studios FZ LLC.
        </p>
      </div>
    </footer>
  )
}
