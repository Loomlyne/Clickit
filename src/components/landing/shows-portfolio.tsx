import Link from 'next/link'
import { getAllShows } from '@/lib/queries'
import { ShowArt } from '@/components/primitives/show-art'
import { SectionHeader } from '@/components/primitives/section-header'
import { ScrollReveal } from '@/components/primitives/scroll-reveal'
import { BRAND_COLOR_HEX } from '@/lib/brand-colors'
import type { ViewShow } from '@/lib/queries'

function ShowPortfolioCard({ show }: { show: ViewShow }) {
  const brandColorHex = BRAND_COLOR_HEX[show.brandColor]

  return (
    <Link href={`/series/${show.slug}`} className="group block">
      <div className="overflow-hidden rounded-[20px] border border-white/10 bg-white/[0.03] shadow-[0_12px_40px_rgba(0,0,0,0.22)] transition-transform duration-300 ease-out group-hover:-translate-y-1">
        <ShowArt
          brandColor={brandColorHex}
          title={show.title}
          aspectRatio="2/3"
          imageUrl={show.posterUrl}
          className="rounded-none"
        >
          {/* Hover overlay bloom */}
          <div
            className="absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
            style={{
              background: `radial-gradient(circle at center, ${brandColorHex}30 0%, transparent 70%)`,
            }}
          />
        </ShowArt>

        {/* Card footer */}
        <div className="px-3 py-3">
          <p className="truncate text-[11px] font-medium uppercase tracking-[0.2em] text-white/40">
            {show.genre}
          </p>
          <p className="mt-0.5 truncate text-sm font-semibold tracking-[-0.02em] text-white">
            {show.title}
          </p>
        </div>

        {/* Brand color accent bar — reveals on hover */}
        <div
          className="h-[2px] opacity-0 transition-opacity duration-300 group-hover:opacity-100"
          style={{ background: brandColorHex, boxShadow: `0 0 16px ${brandColorHex}50` }}
        />
      </div>
    </Link>
  )
}

export async function ShowsPortfolio() {
  const shows = await getAllShows()

  if (shows.length === 0) return null

  return (
    <ScrollReveal>
      <section>
        <SectionHeader title="All Original Shows" />
        <div className="grid grid-cols-2 gap-3 px-6 sm:grid-cols-3 md:gap-4 md:px-12 lg:grid-cols-4 xl:grid-cols-5">
          {shows.map((show) => (
            <ShowPortfolioCard key={show.id} show={show} />
          ))}
        </div>
      </section>
    </ScrollReveal>
  )
}
