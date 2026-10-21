import type { NextConfig } from "next";
import bundleAnalyzer from '@next/bundle-analyzer'
import createNextIntlPlugin from 'next-intl/plugin'
import { initOpenNextCloudflareForDev } from '@opennextjs/cloudflare'
import { buildCsp } from './src/lib/csp'
import { getPublicMediaOrigin } from './src/lib/supabase-media'

// OpenNext dev hook: exposes Cloudflare bindings to `next dev` only. Remote
// bindings stay off: the `AI` binding would otherwise open a remote Workers AI
// session with whatever wrangler login the shell has (and spend neurons). In dev
// the binding is present but its calls fail, so Arabic auto-fill leaves fields empty.
if (process.env.NODE_ENV === 'development') {
  initOpenNextCloudflareForDev({ remoteBindings: false })
}

const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === 'true',
})

// next-intl v4 plugin: wires src/i18n/request.ts into the Next.js build so
// getMessages() / setRequestLocale() resolve at render time. Required once any
// layout/page awaits getMessages() during prerender (Phase 13 [locale]/layout).
const withNextIntl = createNextIntlPlugin()

// Content-Security-Policy: built by src/lib/csp.ts (pure, unit-tested). Hosts
// come from env at build time: Supabase from NEXT_PUBLIC_SUPABASE_URL, the media
// origin from getPublicMediaOrigin(). Only the local preview build sets
// CSP_UPGRADE_INSECURE=false (build-target.mjs); that is also what lets the
// loopback Supabase and media origins into the policy. workersdev and production
// builds never carry them.
const CSP = buildCsp({
  nodeEnv: process.env.NODE_ENV,
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
  mediaOrigin: getPublicMediaOrigin(),
  upgradeInsecure: process.env.CSP_UPGRADE_INSECURE !== 'false' && process.env.NODE_ENV === 'production',
  target: process.env.CSP_UPGRADE_INSECURE === 'false' ? 'preview' : 'production',
})

const nextConfig: NextConfig = {
  // React Compiler (stable in Next 16): auto-memoizes components to cut
  // unnecessary re-renders, no manual useMemo/useCallback. Runs a Babel pass
  // so builds are a little slower; components that break Rules of React are
  // safely skipped, not broken. Reversible by deleting this one line.
  reactCompiler: true,
  experimental: {
    serverActions: {
      bodySizeLimit: '2mb',
    },
    staleTimes: {
      dynamic: 30,
      static: 180,
    },
  },
  // Long-lived cache for immutable brand assets. These files are versioned in
  // git — when we change the logo we'd change the filename. The old host served
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
  // Custom loader: media-origin URLs get ?w=<640|1280|1920> (R2 variants via
  // the clickit-media Worker); every other src is used as-is. No image
  // optimizer service, so no formats / minimumCacheTTL / remotePatterns (those only
  // configure the built-in loader).
  images: {
    loader: 'custom',
    loaderFile: './image-loader.ts',
  },
};

export default withBundleAnalyzer(withNextIntl(nextConfig));
