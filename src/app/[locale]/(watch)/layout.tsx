export default function WatchLayout({ children }: { children: React.ReactNode }) {
  // [locale]/layout.tsx already provides: html, body, NextIntlClientProvider,
  // Toaster, Analytics. This layout only provides a fullscreen black container.
  // No SmoothScroll, no Navbar, no Footer, no Silk, no MarqueeTicker.
  return (
    <div className="h-dvh min-h-svh overflow-hidden bg-black">
      {children}
    </div>
  )
}
