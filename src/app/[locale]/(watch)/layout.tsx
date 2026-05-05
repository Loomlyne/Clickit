export default function WatchLayout({ children }: { children: React.ReactNode }) {
  // [locale]/layout.tsx already provides: html, body, NextIntlClientProvider,
  // Toaster, Analytics. No SmoothScroll, no Navbar, no Footer, no Silk, no MarqueeTicker.
  // Children in this route group are expected to use position:fixed and manage
  // their own viewport coverage — the wrapper div had no visual effect on them.
  return <>{children}</>
}
