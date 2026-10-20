import type { Metadata, Viewport } from 'next'
import { notFound } from 'next/navigation'
import { NextIntlClientProvider, hasLocale } from 'next-intl'
import { getMessages, setRequestLocale } from 'next-intl/server'
import Script from 'next/script'
import localFont from 'next/font/local'

import '@/styles/globals.css'
import { CfWebAnalytics } from '@/components/analytics/cf-web-analytics'
import { Toaster } from 'sonner'
import { MotionConfig } from 'motion/react'
import { getAppConfig } from '@/lib/config'
import { siteUrl } from '@/lib/site-url'
import { dirFor, pickLocalized } from '@/lib/locale'
import { getLocale } from '@/lib/locale-server'
import { routing, staticParams, type Locale } from '@/i18n/routing'

const lbc = localFont({
  src: [
    { path: '../../fonts/lbc-regular.woff2', weight: '400', style: 'normal' },
    { path: '../../fonts/lbc-bold.woff2', weight: '700', style: 'normal' },
  ],
  variable: '--font-lbc',
  display: 'swap',
})


export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
}

/**
 * Pre-renders both /en/* and /ar/* at build time.
 * Phase 12 exported `staticParams` from routing.ts as [{locale:'en'},{locale:'ar'}].
 */
export function generateStaticParams() {
  return staticParams
}

/**
 * Builds the favicon <link> set. When a dark variant is configured we emit two
 * icons keyed by `prefers-color-scheme` media queries so the browser swaps to
 * the visible one as the OS/browser theme flips — preventing a same-colored
 * favicon from vanishing against the tab strip. With only the default favicon we
 * emit a single plain icon (no media query) so it always shows.
 */
function buildFaviconLinks(
  faviconUrl: string | null,
  faviconDarkUrl: string | null
) {
  const light = faviconUrl ?? '/favicon.ico'
  if (!faviconDarkUrl) return light
  return [
    { url: light, media: '(prefers-color-scheme: light)' },
    { url: faviconDarkUrl, media: '(prefers-color-scheme: dark)' },
  ]
}

export async function generateMetadata(): Promise<Metadata> {
  const [config, locale] = await Promise.all([getAppConfig(), getLocale()])
  // Arabic SEO/meta description when the viewer's locale is ar (English fallback).
  const description =
    pickLocalized(locale, config.siteDescription ?? '', config.siteDescriptionAr) ||
    'Original shows from the UAE - streaming now'
  return {
    metadataBase: new URL(siteUrl()),
    title: config.siteTitle,
    description,
    icons: { icon: buildFaviconLinks(config.faviconUrl, config.faviconDarkUrl) },
    openGraph: config.ogImageUrl
      ? {
          title: config.siteTitle,
          description,
          images: [{ url: config.ogImageUrl }],
          type: 'website',
        }
      : {
          title: config.siteTitle,
          description,
          type: 'website',
        },
    twitter: {
      card: 'summary_large_image',
      title: config.siteTitle,
      description,
      images: config.ogImageUrl ? [config.ogImageUrl] : undefined,
    },
  }
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}) {
  // Next.js 16: params is async.
  const { locale } = await params

  // Validate + narrow to Locale union. Rejects /xx/foo with 404.
  if (!hasLocale(routing.locales, locale)) {
    notFound()
  }

  // Required for static rendering with next-intl v4.
  setRequestLocale(locale)

  // getMessages() resolves through src/i18n/request.ts → dynamic import of
  // `../messages/${locale}.json`. Phase 12 has empty dictionaries; that's
  // intentional — missing keys will surface as MISSING_MESSAGE warnings in
  // Phases 15-17 rather than silently fall back to English.
  const messages = await getMessages()

  const { googleAnalyticsId: rawGaId, metaPixelId: rawPixelId } = await getAppConfig()
  // Harden against stored XSS: these admin-controlled IDs are interpolated into
  // inline <Script> bodies, so allow only the exact provider ID formats.
  const googleAnalyticsId = /^G-[A-Z0-9]{4,20}$/.test(rawGaId ?? '') ? rawGaId : null
  const metaPixelId = /^[0-9]{6,20}$/.test(rawPixelId ?? '') ? rawPixelId : null
  const dir = dirFor(locale as Locale)

  return (
    <html
      lang={locale}
      dir={dir}
      className={['dark', lbc.variable].join(' ')}
    >
      <body className="bg-background text-foreground selection:bg-primary/70 selection:text-primary-foreground font-sans antialiased">
        <a
          href="#main"
          className="focus:bg-card focus:text-foreground focus:ring-ring sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[60] focus:rounded-full focus:px-4 focus:py-2 focus:ring-2"
        >
          Skip to content
        </a>
        <NextIntlClientProvider locale={locale} messages={messages}>
          {/* reducedMotion="user" makes all motion components auto-respect the
              OS prefers-reduced-motion setting (disables transform/scroll
              animations, keeps opacity) — one switch for all 12 motion files. */}
          <MotionConfig reducedMotion="user">
            <main id="main" tabIndex={-1}>
              {children}
            </main>
          </MotionConfig>
        </NextIntlClientProvider>
        <Toaster
          theme="dark"
          toastOptions={{
            classNames: {
              toast:
                'border border-white/10 bg-[#10131a] text-foreground shadow-[0_24px_80px_rgba(0,0,0,0.45)]',
              description: 'text-muted-foreground',
              actionButton: 'bg-primary text-primary-foreground',
              cancelButton: 'bg-secondary text-secondary-foreground',
            },
          }}
        />
        <CfWebAnalytics token={process.env.NEXT_PUBLIC_CF_BEACON_TOKEN} />

        {googleAnalyticsId && (
          <>
            <Script
              src={`https://www.googletagmanager.com/gtag/js?id=${googleAnalyticsId}`}
              strategy="afterInteractive"
            />
            <Script id="gtag-init" strategy="afterInteractive">
              {`
                window.dataLayer = window.dataLayer || [];
                function gtag(){dataLayer.push(arguments);}
                gtag('js', new Date());
                gtag('config', '${googleAnalyticsId}');
              `}
            </Script>
          </>
        )}

        {metaPixelId && (
          <Script id="meta-pixel" strategy="afterInteractive">
            {`
              !function(f,b,e,v,n,t,s)
              {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
              n.callMethod.apply(n,arguments):n.queue.push(arguments)};
              if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
              n.queue=[];t=b.createElement(e);t.async=!0;
              t.src=v;s=b.getElementsByTagName(e)[0];
              s.parentNode.insertBefore(t,s)}(window, document,'script',
              'https://connect.facebook.net/en_US/fbevents.js');
              fbq('init', '${metaPixelId}');
              fbq('track', 'PageView');
            `}
          </Script>
        )}
      </body>
    </html>
  )
}
