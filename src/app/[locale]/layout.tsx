import type { Metadata, Viewport } from 'next'
import { notFound } from 'next/navigation'
import { NextIntlClientProvider, hasLocale } from 'next-intl'
import { getMessages, setRequestLocale } from 'next-intl/server'
import Script from 'next/script'
import { Analytics } from '@vercel/analytics/next'
import { SpeedInsights } from '@vercel/speed-insights/next'
import { Geist, Cairo } from 'next/font/google'
import localFont from 'next/font/local'

import '@/styles/globals.css'
import { Toaster } from 'sonner'
import { getAppConfig } from '@/lib/config'
import { siteUrl } from '@/lib/site-url'
import { dirFor } from '@/lib/locale'
import { routing, staticParams, type Locale } from '@/i18n/routing'

const geist = Geist({
  subsets: ['latin'],
  variable: '--font-geist',
  weight: ['300', '400', '500', '600', '700', '800'],
  display: 'swap',
})

const lbc = localFont({
  src: [
    { path: '../../fonts/lbc-regular.ttf', weight: '400', style: 'normal' },
    { path: '../../fonts/lbc-bold.ttf', weight: '700', style: 'normal' },
  ],
  variable: '--font-lbc',
  display: 'swap',
})

// TEMPORARY STAND-IN for GE SS (commercial Boutros font). Cairo is the closest
// freely-licensed Arabic match. Swap by replacing this block with a localFont
// import once `src/fonts/ge-ss-regular.ttf` + `ge-ss-bold.ttf` are added.
const geSS = Cairo({
  subsets: ['arabic', 'latin'],
  variable: '--font-ge-ss',
  weight: ['400', '500', '600', '700'],
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

export async function generateMetadata(): Promise<Metadata> {
  const config = await getAppConfig()
  return {
    metadataBase: new URL(siteUrl()),
    title: config.siteTitle,
    description: config.siteDescription ?? 'Original shows from the UAE - streaming now',
    icons: config.faviconUrl ? { icon: config.faviconUrl } : undefined,
    openGraph: config.ogImageUrl
      ? {
          title: config.siteTitle,
          description: config.siteDescription ?? undefined,
          images: [{ url: config.ogImageUrl }],
          type: 'website',
        }
      : {
          title: config.siteTitle,
          description: config.siteDescription ?? undefined,
          type: 'website',
        },
    twitter: {
      card: 'summary_large_image',
      title: config.siteTitle,
      description: config.siteDescription ?? undefined,
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

  const { googleAnalyticsId, metaPixelId } = await getAppConfig()
  const dir = dirFor(locale as Locale)

  return (
    <html
      lang={locale}
      dir={dir}
      className={['dark', geist.variable, lbc.variable, geSS.variable].join(' ')}
    >
      <body className="bg-background text-foreground font-sans antialiased selection:bg-primary/70 selection:text-primary-foreground">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[60] focus:rounded-full focus:bg-card focus:px-4 focus:py-2 focus:text-foreground focus:ring-2 focus:ring-ring"
        >
          Skip to content
        </a>
        <NextIntlClientProvider locale={locale} messages={messages}>
          <main id="main" tabIndex={-1}>
            {children}
          </main>
        </NextIntlClientProvider>
        <Toaster
          theme="dark"
          toastOptions={{
            classNames: {
              toast: 'border border-white/10 bg-[#10131a] text-foreground shadow-[0_24px_80px_rgba(0,0,0,0.45)]',
              description: 'text-muted-foreground',
              actionButton: 'bg-primary text-primary-foreground',
              cancelButton: 'bg-secondary text-secondary-foreground',
            },
          }}
        />
        <Analytics />
        <SpeedInsights />

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
