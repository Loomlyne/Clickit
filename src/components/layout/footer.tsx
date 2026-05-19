import Image from 'next/image'
import { getTranslations } from 'next-intl/server'
import { Link } from '@/i18n/navigation'
import { getAppConfig } from '@/lib/config'
import { PLATFORM_MAP } from '@/lib/social-platforms'

export async function Footer() {
  const [{ footer }, t, tNav] = await Promise.all([
    getAppConfig(),
    getTranslations('footer'),
    getTranslations('nav'),
  ])

  const socialLinks = footer.social.filter((s) => s.url.trim() !== '')

  return (
    <footer className="relative overflow-hidden border-t border-[var(--line)] bg-[var(--bg-1)]">
      {/* Hero wordmark + contact */}
      <div className="relative border-b border-[var(--line)] px-4 pt-[90px] pb-[60px] sm:px-6 md:px-12">
        <Link href="/watch" aria-label={tNav('home')} className="block">
          <Image
            src="/brand/Clickit_final_logo.svg"
            alt="Clickit"
            width={486}
            height={199}
            className="h-auto w-full max-w-[clamp(200px,42vw,520px)]"
            priority
          />
        </Link>

        <div className="mt-10 flex flex-col justify-between gap-10 md:flex-row md:items-end">
          <p className="font-display m-0 max-w-[420px] text-[16px] leading-relaxed text-[var(--text-dim)] italic">
            {footer.tagline || t('fallbackTagline')}
          </p>
          <div className="w-full max-w-sm">
            <div className="mono mb-3" style={{ letterSpacing: '0.14em' }}>
              {t('directContact')}
            </div>
            <Link
              href="/support#contact-form"
              className="inline-flex min-h-12 w-full items-center justify-center rounded-full border border-[var(--line)] bg-[var(--text)] px-5 text-sm font-semibold text-[var(--bg-0)] transition-colors hover:bg-[var(--accent)]"
            >
              {t('openContact')}
            </Link>

            {/* Social links */}
            {socialLinks.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-3">
                {socialLinks.map((item, i) => {
                  const meta = PLATFORM_MAP[item.platform]
                  if (!meta) return null
                  const Icon = meta.Icon
                  return (
                    <a
                      key={i}
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mono flex items-center gap-1.5 text-[12px] text-[var(--text-dim)] transition-colors hover:text-[var(--text)]"
                    >
                      <Icon className="size-3.5 shrink-0" />
                      {meta.label}
                    </a>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="mx-auto flex max-w-[1400px] flex-wrap items-center justify-between gap-4 px-4 py-5 sm:px-6 md:px-10">
        <span className="mono text-[12px] text-[var(--text-dim)]">
          © {new Date().getFullYear()} Clickit Story
        </span>
        <div className="mono flex flex-wrap items-center gap-5 text-[12px] text-[var(--text-dim)]">
          <Link
            href="/terms"
            className="transition-colors hover:text-[var(--text)]"
          >
            {t('termsOfUse')}
          </Link>
          <span aria-hidden>·</span>
          <Link
            href="/privacy"
            className="transition-colors hover:text-[var(--text)]"
          >
            {t('privacy')}
          </Link>
          <span aria-hidden>·</span>
          <Link
            href="/support"
            className="transition-colors hover:text-[var(--text)]"
          >
            {t('support')}
          </Link>
        </div>
      </div>
    </footer>
  )
}
