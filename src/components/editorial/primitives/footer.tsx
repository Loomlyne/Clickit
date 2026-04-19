import Link from 'next/link'

/**
 * Editorial footer — 4-column grid (logo/tagline · Explore · Company · Legal).
 * Ported from components.jsx Footer().
 */
export function EditorialFooter() {
  return (
    <footer className="footer">
      <div className="footer-grid">
        <div>
          <div className="logo" style={{ marginBottom: 14 }}>
            <span className="dot" />
            CLICKIT
          </div>
          <p style={{ color: 'var(--text-dim)', fontSize: 14, margin: 0, maxWidth: 320 }}>
            Original shows from the UAE — travel, music, comedy, cooking, kids, poetry, tech, and more.
          </p>
        </div>
        <div>
          <h4>Explore</h4>
          <ul>
            <li><Link href="/browse">Browse all</Link></li>
            <li><Link href="/coming-soon">Coming soon</Link></li>
            <li><Link href="/search">Search</Link></li>
            <li><Link href="/my-list">My list</Link></li>
          </ul>
        </div>
        <div>
          <h4>Company</h4>
          <ul>
            <li><Link href="/support">Support</Link></li>
            <li><Link href="/support">About</Link></li>
            <li><Link href="/support">Contact</Link></li>
          </ul>
        </div>
        <div>
          <h4>Legal</h4>
          <ul>
            <li><Link href="/support">Terms of service</Link></li>
            <li><Link href="/support">Privacy policy</Link></li>
            <li><Link href="/support">Accessibility</Link></li>
          </ul>
        </div>
      </div>
      <div className="footer-bottom">
        <span>© {new Date().getFullYear()} Clickit Story · Spacelight Studios FZ LLC</span>
        <span>Abu Dhabi · Dubai</span>
      </div>
    </footer>
  )
}
