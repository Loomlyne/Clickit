import type { Metadata, Viewport } from 'next'
import Script from 'next/script'
import { Analytics } from '@vercel/analytics/next'
import { SpeedInsights } from '@vercel/speed-insights/next'
import { Plus_Jakarta_Sans, Cairo } from 'next/font/google'

import '@/styles/globals.css'
import { Toaster } from 'sonner'
import { getAppConfig } from '@/lib/config'

const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-jakarta',
  weight: ['400', '500', '600', '700', '800'],
  display: 'swap',
})

const cairo = Cairo({
  subsets: ['arabic', 'latin'],
  variable: '--font-cairo',
  weight: ['400', '500', '600', '700', '900'],
  display: 'swap',
})

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
}

// Dynamic metadata — reads admin-controlled title/description/OG image from
// app_config via the same unstable_cache-backed helper. Any save in the
// Branding or General tab triggers updateTag('site-config') which invalidates
// this and the next request picks up the new values.
export async function generateMetadata(): Promise<Metadata> {
  const config = await getAppConfig()
  return {
    title: config.siteTitle,
    description: config.siteDescription ?? 'Original shows from the UAE - streaming now',
    icons: config.faviconUrl
      ? { icon: config.faviconUrl }
      : undefined,
    openGraph: config.ogImageUrl
      ? {
          title: config.siteTitle,
          description: config.siteDescription ?? undefined,
          images: [{ url: config.ogImageUrl }],
        }
      : undefined,
  }
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { googleAnalyticsId, metaPixelId } = await getAppConfig()

  return (
    <html lang="en" className={`dark ${jakarta.variable} ${cairo.variable}`}>
      <body className="bg-background text-foreground font-sans antialiased selection:bg-primary/70 selection:text-primary-foreground">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[60] focus:rounded-full focus:bg-card focus:px-4 focus:py-2 focus:text-foreground focus:ring-2 focus:ring-ring"
        >
          Skip to content
        </a>
        <main id="main" tabIndex={-1}>
          {children}
        </main>
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

        {/* Admin-configured analytics — only rendered when an ID is saved. */}
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
