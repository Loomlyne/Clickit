import type { NextConfig } from "next";
import { withBotId } from 'botid/next/config'

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: '55mb',
    },
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
