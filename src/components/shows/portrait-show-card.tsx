'use client'

import Link from 'next/link'
import { Heart, Bookmark, Share2 } from 'lucide-react'

import { ShowArt } from '@/components/primitives/show-art'
import type { ViewShow } from '@/lib/queries'
import { BRAND_COLOR_HEX } from '@/lib/brand-colors'

interface PortraitShowCardProps {
  show: ViewShow
}

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}

export function PortraitShowCard({ show }: PortraitShowCardProps) {
  const brandColorHex = BRAND_COLOR_HEX[show.brandColor]
  const likeCount = 0
  const handle = '@clickitstory'
  const instagramUrl = 'https://www.instagram.com/clickitstory'

  return (
    <div className="group cursor-pointer">
      {/* Card art */}
      <div className="relative overflow-hidden rounded-xl">

        {/* Show detail navigation wraps the art */}
        <Link href={`/series/${show.slug}`} className="block">
          <ShowArt brandColor={brandColorHex} title={show.title} aspectRatio="2/3">

            {/* Bottom gradient overlay — info + action bar */}
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black via-black/70 to-transparent px-3 pb-3 pt-16">
              <p className="truncate font-bold text-sm leading-tight text-white">{show.title}</p>
              <p className="mt-0.5 text-xs text-white/50">{show.genre}</p>

              {/* Action bar — inside the card on the gradient */}
              <div className="mt-2.5 flex items-center gap-3">
                <span className="flex items-center gap-1.5 text-white/60">
                  <Heart className="size-4" />
                  <span className="text-xs">{formatCount(likeCount)}</span>
                </span>
                <span className="text-white/60">
                  <Bookmark className="size-4" />
                </span>
                <span className="ml-auto text-white/60">
                  <Share2 className="size-4" />
                </span>
              </div>
            </div>
          </ShowArt>
        </Link>

        {/* Instagram handle badge — sits above the Link, clicks go to Instagram */}
        <a
          href={instagramUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="absolute left-0 right-0 top-0 z-10 flex items-center gap-1.5 bg-gradient-to-b from-black/60 to-transparent px-3 py-3"
          aria-label={`Open ${handle} on Instagram`}
        >
          {/* Instagram icon */}
          <svg className="h-3.5 w-3.5 shrink-0 text-white/70" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
            <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
            <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
          </svg>
          <span className="text-xs font-medium text-white/80 hover:text-white transition-colors truncate">
            {handle}
          </span>
        </a>

        {/* Brand color glow — on group hover */}
        <div
          className="absolute inset-x-0 bottom-0 h-0.5 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
          style={{ background: brandColorHex, boxShadow: `0 -8px 20px ${brandColorHex}60` }}
        />
      </div>

    </div>
  )
}
