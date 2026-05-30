import type { NextConfig } from "next";
import bundleAnalyzer from '@next/bundle-analyzer'
import { withBotId } from 'botid/next/config'
import createNextIntlPlugin from 'next-intl/plugin'

const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === 'true',
})

// next-intl v4 plugin: wires src/i18n/request.ts into the Next.js build so
// getMessages() / setRequestLocale() resolve at render time. Required once any
// layout/page awaits getMessages() during prerender (Phase 13 [locale]/layout).
const withNextIntl = createNextIntlPlugin()

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: '55mb',
    },
    staleTimes: {
      dynamic: 30,
      static: 180,
    },
  },
  // Long-lived cache for immutable brand assets. These files are versioned in
  // git — when we change the logo we'd change the filename. Vercel was serving
  // them with `cache-control: max-age=0, must-revalidate` which forced every
  // page load to re-validate the SVG, wasting ~700ms of LCP on the landing
  // page (the logo is the LCP element). Now it's cached for a year, immutable.
  async redirects() {
    return [
      {
        source: '/:path*',
        has: [{ type: 'host', value: 'clickitstory.ae' }],
        destination: 'https://clickitstory.com/:path*',
        permanent: true,
      },
      {
        source: '/:path*',
        has: [{ type: 'host', value: 'www.clickitstory.ae' }],
        destination: 'https://clickitstory.com/:path*',
        permanent: true,
      },
    ]
  },
  async headers() {
    return [
      {
        // Baseline security headers on every route. (A tuned Content-Security-
        // Policy is intentionally deferred — it needs testing against YouTube,
        // Supabase, GA/Pixel and inline scripts before enforcing.)
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(), browsing-topics=()',
          },
        ],
      },
      {
        source: '/brand/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
    ]
  },
  images: {
    formats: ['image/avif', 'image/webp'],
    // Cache optimized images (YouTube thumbnails, show artwork) for 24h instead
    // of re-optimizing every request — cuts image function invocations + latency.
    minimumCacheTTL: 86400,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'img.youtube.com',
        pathname: '/vi/**',
      },
      {
        protocol: 'https',
        hostname: 'i.ytimg.com',
        pathname: '/vi/**',
      },
      {
        protocol: 'https',
        hostname: 'yt3.ggpht.com',
      },
      {
        protocol: 'https',
        hostname: 'picsum.photos',
      },
      {
        protocol: 'https',
        hostname: 'fastly.picsum.photos',
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
      {
        protocol: 'https',
        hostname: 'lajguozmtissnnfccmej.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },
};

// withBotId wires the BotID challenge into Vercel's edge so sign-in/sign-up
// requests carry a verifiable bot-score header. Server Actions gate on
// checkBotId() before touching Supabase (see the auth actions under
// src/app/[locale]/(viewer)/auth/actions.ts).
export default withBundleAnalyzer(withBotId(withNextIntl(nextConfig)));
