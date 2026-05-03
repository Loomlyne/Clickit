import { Link } from '@/i18n/navigation'

export function Footer() {
  return (
    <footer className="border-t border-[var(--line)] bg-[var(--bg-1)]">
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
