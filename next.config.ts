import type { NextConfig } from "next";
import { withBotId } from 'botid/next/config'

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: '55mb',
    },
  },
  // Long-lived cache for immutable brand assets. These files are versioned in
  // git — when we change the logo we'd change the filename. Vercel was serving
  // them with `cache-control: max-age=0, must-revalidate` which forced every
  // page load to re-validate the SVG, wasting ~700ms of LCP on the landing
  // page (the logo is the LCP element). Now it's cached for a year, immutable.
  async headers() {
    return [
      {
        source: '/brand/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
    ]
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'img.youtube.com',
        pathname: '/vi/**',
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
        hostname: 'lajguozmtissnnfccmej.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },
};

// withBotId wires the BotID challenge into Vercel's edge so sign-in/sign-up
// requests carry a verifiable bot-score header. Server Actions gate on
// checkBotId() before touching Supabase (see src/app/(viewer)/auth/actions.ts).
export default withBotId(nextConfig);
