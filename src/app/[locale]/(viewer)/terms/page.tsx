import type { Metadata } from 'next'
import { Link } from '@/i18n/navigation'

export const metadata: Metadata = {
  title: 'Terms of Use | Clickit Story',
  description: 'Terms of use for the Clickit Story streaming platform.',
}

export default function TermsPage() {
  return (
    <main className="mx-auto max-w-[860px] px-4 py-24 sm:px-6 md:px-10">
      <div className="mono mb-4 text-[var(--text-mute)]">Legal</div>
      <h1 className="font-[family-name:var(--font-display)] text-[clamp(36px,5vw,64px)] font-normal leading-none tracking-[-0.02em] mb-12">
        Terms of Use
      </h1>
      <div className="prose prose-invert max-w-none space-y-8 text-[15px] leading-relaxed text-[var(--text-dim)]">
        <section>
          <h2 className="font-[family-name:var(--font-display)] text-[22px] font-normal text-[var(--text)] mb-3">1. Acceptance</h2>
          <p>By accessing or using the Clickit Story platform, you agree to be bound by these Terms of Use. If you do not agree, do not use the platform.</p>
        </section>
        <section>
          <h2 className="font-[family-name:var(--font-display)] text-[22px] font-normal text-[var(--text)] mb-3">2. Platform Access</h2>
          <p>Clickit Story grants you a limited, non-exclusive, non-transferable licence to access and stream content on the platform for personal, non-commercial use.</p>
        </section>
        <section>
          <h2 className="font-[family-name:var(--font-display)] text-[22px] font-normal text-[var(--text)] mb-3">3. Content</h2>
          <p>All content on Clickit Story is owned by or licensed to Spacelight Studios FZ LLC. You may not copy, reproduce, distribute, or create derivative works from any content without express written permission.</p>
        </section>
        <section>
          <h2 className="font-[family-name:var(--font-display)] text-[22px] font-normal text-[var(--text)] mb-3">4. User Accounts</h2>
          <p>You are responsible for maintaining the confidentiality of your account credentials. Clickit Story reserves the right to suspend or terminate accounts that violate these terms.</p>
        </section>
        <section>
          <h2 className="font-[family-name:var(--font-display)] text-[22px] font-normal text-[var(--text)] mb-3">5. Changes</h2>
          <p>We may update these terms at any time. Continued use of the platform after changes constitutes acceptance of the revised terms.</p>
        </section>
        <section>
          <h2 className="font-[family-name:var(--font-display)] text-[22px] font-normal text-[var(--text)] mb-3">6. Contact</h2>
          <p>
            Questions about these terms? Reach us via the{' '}
            <Link href="/support" className="text-[var(--primary)] hover:underline">
              support page
            </Link>
            .
          </p>
        </section>
        <p className="mono text-[11px] text-[var(--text-mute)] pt-8 border-t border-[var(--line)]">
          Last updated: May 2026 · Spacelight Studios FZ LLC, Yas Creative Hub, Abu Dhabi, UAE
        </p>
      </div>
    </main>
  )
}
