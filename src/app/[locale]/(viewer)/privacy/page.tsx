import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Privacy Policy | Clickit Story',
  description: 'Privacy policy for the Clickit Story streaming platform.',
}

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-[860px] px-4 py-24 sm:px-6 md:px-10">
      <div className="mono mb-4 text-[var(--text-mute)]">Legal</div>
      <h1 className="font-[family-name:var(--font-display)] text-[clamp(36px,5vw,64px)] font-normal leading-none tracking-[-0.02em] mb-12">
        Privacy Policy
      </h1>
      <div className="prose prose-invert max-w-none space-y-8 text-[15px] leading-relaxed text-[var(--text-dim)]">
        <section>
          <h2 className="font-[family-name:var(--font-display)] text-[22px] font-normal text-[var(--text)] mb-3">1. Information We Collect</h2>
          <p>We collect information you provide when creating an account (email address), and usage data such as watch history and saved lists. We do not sell your personal data.</p>
        </section>
        <section>
          <h2 className="font-[family-name:var(--font-display)] text-[22px] font-normal text-[var(--text)] mb-3">2. How We Use It</h2>
          <p>Your data is used solely to operate the platform — to remember your progress, maintain your watchlist, and improve the service. We do not use your data to serve targeted advertisements.</p>
        </section>
        <section>
          <h2 className="font-[family-name:var(--font-display)] text-[22px] font-normal text-[var(--text)] mb-3">3. Video Streaming</h2>
          <p>Content is delivered via YouTube embeds. When you watch a video, YouTube's own privacy policy applies to that playback session. We recommend reviewing <a href="https://policies.google.com/privacy" target="_blank" rel="noreferrer" className="text-[var(--primary)] hover:underline">Google's Privacy Policy</a>.</p>
        </section>
        <section>
          <h2 className="font-[family-name:var(--font-display)] text-[22px] font-normal text-[var(--text)] mb-3">4. Data Storage</h2>
          <p>Account data is stored securely via Supabase (hosted on AWS infrastructure in the EU region). Passwords are never stored in plain text.</p>
        </section>
        <section>
          <h2 className="font-[family-name:var(--font-display)] text-[22px] font-normal text-[var(--text)] mb-3">5. Your Rights</h2>
          <p>You may request deletion of your account and associated data at any time via the <a href="/support" className="text-[var(--primary)] hover:underline">support page</a>.</p>
        </section>
        <section>
          <h2 className="font-[family-name:var(--font-display)] text-[22px] font-normal text-[var(--text)] mb-3">6. Cookies</h2>
          <p>We use session cookies strictly necessary for authentication. No third-party advertising cookies are set by Clickit Story.</p>
        </section>
        <p className="mono text-[11px] text-[var(--text-mute)] pt-8 border-t border-[var(--line)]">
          Last updated: May 2026 · Spacelight Studios FZ LLC, Yas Creative Hub, Abu Dhabi, UAE
        </p>
      </div>
    </main>
  )
}
