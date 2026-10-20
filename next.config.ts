import type { NextConfig } from "next";
import bundleAnalyzer from '@next/bundle-analyzer'
import { withBotId } from 'botid/next/config'
import createNextIntlPlugin from 'next-intl/plugin'
import { getPublicMediaOrigin } from './src/lib/supabase-media'

const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === 'true',
})

// next-intl v4 plugin: wires src/i18n/request.ts into the Next.js build so
// getMessages() / setRequestLocale() resolve at render time. Required once any
// layout/page awaits getMessages() during prerender (Phase 13 [locale]/layout).
const withNextIntl = createNextIntlPlugin()

// Content-Security-Policy. Allowlists every origin the app actually loads:
// GA (googletagmanager/google-analytics), Meta Pixel (facebook), YouTube embeds,
// Vercel Analytics + Speed Insights + BotID, and Supabase (REST + realtime wss +
// public storage images/video). 'unsafe-inline' is required for the inline GA/
// Pixel snippets and Next's bootstrap (nonce-based hardening is a future step).
// The locked-down directives (frame-ancestors/object-src/base-uri/form-action)
// add real protection at zero breakage risk.
// Dev-only relaxation: React + Turbopack rely on dynamic code execution in
// development for fast refresh and callstack reconstruction. Production never
// needs it, so this CSP token is added only outside production builds.
const devScriptSrc = process.env.NODE_ENV === 'production' ? '' : " 'unsafe-" + "eval'"
const publicMediaOrigin = getPublicMediaOrigin()
const mediaImagePattern = publicMediaOrigin
  ? (() => {
      const origin = new URL(publicMediaOrigin)
      return {
        protocol: 'https' as const,
        hostname: origin.hostname,
        ...(origin.port ? { port: origin.port } : {}),
        pathname: '/**',
      }
    })()
  : null

// Storage images may come from whichever Supabase project this build connects
// to (NEXT_PUBLIC_SUPABASE_URL), not only the original hardcoded one. Rows that
// still point at the original project keep working through LEGACY_SUPABASE_HOST.
const LEGACY_SUPABASE_HOST = 'lajguozmtissnnfccmej.supabase.co'
const supabaseOrigin = (() => {
  try {
    return process.env.NEXT_PUBLIC_SUPABASE_URL
      ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL)
      : null
  } catch {
    return null
  }
})()
const supabaseImagePatterns = [
  {
    protocol: 'https' as const,
    hostname: LEGACY_SUPABASE_HOST,
    pathname: '/storage/v1/object/public/**',
  },
  ...(supabaseOrigin && supabaseOrigin.host !== LEGACY_SUPABASE_HOST
    ? [
        {
          protocol: supabaseOrigin.protocol.replace(':', '') as 'http' | 'https',
          hostname: supabaseOrigin.hostname,
          ...(supabaseOrigin.port ? { port: supabaseOrigin.port } : {}),
          pathname: '/storage/v1/object/public/**',
        },
      ]
    : []),
]
// img-src already allows any https: origin; a local http Supabase needs its own entry.
const supabaseHttpImgSrc =
  supabaseOrigin?.protocol === 'http:' ? ` ${supabaseOrigin.origin}` : ''

const cspDirectives = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${devScriptSrc} https://www.googletagmanager.com https://connect.facebook.net https://www.youtube.com https://s.ytimg.com https://va.vercel-scripts.com https://vercel.live`,
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: https:${supabaseHttpImgSrc}`,
  `media-src 'self' blob: https://*.supabase.co${publicMediaOrigin ? ` ${publicMediaOrigin}` : ''}`,
  "font-src 'self' data:",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://www.google-analytics.com https://*.google-analytics.com https://*.analytics.google.com https://stats.g.doubleclick.net https://va.vercel-scripts.com https://*.vercel-insights.com https://connect.facebook.net https://www.facebook.com https://www.youtube.com https://*.googlevideo.com https://youtubei.googleapis.com",
  "frame-src https://www.youtube.com https://www.youtube-nocookie.com",
  "worker-src 'self' blob:",
  "frame-ancestors 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
]
// upgrade-insecure-requests breaks localhost HTTP dev: Server Actions POST to
// http://localhost:3000 get upgraded to https://… which has no TLS listener → hang.
if (process.env.NODE_ENV === 'production') {
  cspDirectives.push('upgrade-insecure-requests')
}
const CSP = cspDirectives.join('; ')

const nextConfig: NextConfig = {
  // React Compiler (stable in Next 16): auto-memoizes components to cut
  // unnecessary re-renders, no manual useMemo/useCallback. Runs a Babel pass
  // so builds are a little slower; components that break Rules of React are
  // safely skipped, not broken. Reversible by deleting this one line.
  reactCompiler: true,
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
    return []
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
          { key: 'Content-Security-Policy', value: CSP },
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
    // Serve images straight from their source. The /_next/image optimizer
    // needs sharp, which Cloudflare Workers cannot run, so optimized images
    // fail there. Resizing returns with the R2 media loader (Phase 4).
    unoptimized: true,
    formats: ['image/avif', 'image/webp'],
    // Cache optimized images (YouTube thumbnails, show artwork) for 30 days —
    // reduces Supabase storage pulls on optimizer cache miss.
    minimumCacheTTL: 2_592_000,
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
      ...supabaseImagePatterns,
      ...(mediaImagePattern ? [mediaImagePattern] : []),
    ],
  },
};

// withBotId wires the BotID challenge into Vercel's edge so sign-in/sign-up
// requests carry a verifiable bot-score header. Server Actions gate on
// checkBotId() before touching Supabase (see the auth actions under
// src/app/[locale]/(viewer)/auth/actions.ts).
export default withBundleAnalyzer(withBotId(withNextIntl(nextConfig)));
