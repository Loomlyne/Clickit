'use client'

import Link from 'next/link'
import { useState } from 'react'
import { Icon } from './primitives/icons'
import { EditorialHeader } from './primitives/header'
import { EditorialFooter } from './primitives/footer'
import type { EditorialShow } from '@/lib/editorial/adapter'

export type LandingProps = {
  featuredShows: EditorialShow[]
  allShows: EditorialShow[]
  genres: Array<{ name: string; count: number }>
  faqs: Array<{ q: string; a: string }>
  stats?: Array<{ n: string; l: string }>
  tagline?: string
  subTagline?: string
}

/**
 * Editorial landing page (signed out).
 * Ported from Clickit- handoff/project/src/landing.jsx (editorial split variant).
 *
 * Sections:
 *   001 Hero (backdrop + left-aligned headline + CTAs)
 *   002 Stats (4 numbers)
 *   003 What to watch (4-up featured grid)
 *   004 Why Clickit (2-col features)
 *   005 Genres tiles
 *   006 FAQ accordion
 *   007 CTA banner
 */
export function EditorialLanding({
  featuredShows,
  allShows,
  genres,
  faqs,
  stats,
  tagline = "Original stories from the city that can't sleep.",
  subTagline = 'Clickit Story is a hand-curated channel for culture, travel, food and music — produced in Abu Dhabi, streaming everywhere.',
}: LandingProps) {
  const [openFaq, setOpenFaq] = useState(0)
  const featured = featuredShows[0] ?? allShows[0]
  const bannerShow = allShows[2] ?? featured

  const defaultStats = stats ?? [
    { n: String(allShows.length), l: 'Original shows' },
    { n: String(allShows.reduce((a, s) => a + s.episodes, 0)), l: 'Episodes streaming' },
    { n: '2', l: 'Languages (EN · AR)' },
    { n: 'UAE', l: 'Made in' },
  ]

  const features = [
    {
      n: '01',
      h: 'Editors, not algorithms.',
      b: 'Every show on Clickit is picked by humans. No recommendation engine pushing you toward six more of the same thing.',
    },
    {
      n: '02',
      h: 'Independent creators, bilingual by default.',
      b: 'We partner with filmmakers directly. All shows are available in Arabic and English — subtitles, dubs, or both.',
    },
    {
      n: '03',
      h: 'One catalog. No ads.',
      b: 'Travel, music, comedy, cooking, kids, poetry, cinema, tech, and more. All from Abu Dhabi, all connected.',
    },
  ]

  return (
    <div className="page-enter">
      <EditorialHeader isLanding />

      {/* 001 Hero — editorial split variant */}
      <section className="landing-hero">
        {featured?.backdrop && (
          <div
            className="landing-hero-bg"
            style={{ backgroundImage: `url(${featured.backdrop})` }}
          />
        )}
        <div className="landing-hero-scrim" />
        <div className="landing-hero-inner">
          <div className="landing-eyebrow">Now streaming · Abu Dhabi</div>
          <h1 className="landing-title">
            {tagline.split("can't sleep").length > 1 ? (
              <>
                {tagline.split("can't sleep")[0]}
                <em>can&apos;t sleep.</em>
                {tagline.split("can't sleep")[1]?.replace(/^\./, '')}
              </>
            ) : (
              tagline
            )}
          </h1>
          <p className="landing-sub">{subTagline}</p>
          <div className="landing-cta-row">
            <Link href="/browse" className="btn btn-primary btn-lg">
              <Icon.Play /> Start watching free
            </Link>
            <Link href="/coming-soon" className="btn btn-outline btn-lg">
              See what&apos;s coming
            </Link>
            <span className="landing-social">Bilingual · No ads · Free beta</span>
          </div>
        </div>
      </section>

      {/* 002 Stats */}
      <section className="stats">
        {defaultStats.map((s) => (
          <div key={s.l} className="stat">
            <div className="stat-num">{s.n}</div>
            <div className="stat-label">{s.l}</div>
          </div>
        ))}
      </section>

      {/* 003 What to watch */}
      <section className="section" id="shows">
        <div className="section-eyebrow">002 · What to watch</div>
        <h2 className="section-title">A catalog curated by editors, not by clicks.</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 20 }}>
          {allShows.slice(0, 4).map((s) => (
            <Link key={s.id} href={`/series/${s.slug}`} style={{ cursor: 'pointer' }}>
              <div style={{ aspectRatio: '2 / 3', overflow: 'hidden', borderRadius: 4, marginBottom: 14, background: 'var(--bg-2)' }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={s.poster}
                  alt={s.title}
                  style={{ width: '100%', height: '100%', objectFit: 'cover', transition: 'transform 0.4s var(--ease)' }}
                />
              </div>
              <div className="mono" style={{ marginBottom: 4 }}>
                {s.genre} · {s.year}
              </div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 22, letterSpacing: '-0.01em', marginBottom: 6 }}>
                {s.title}
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-dim)' }}>{s.tagline}</div>
            </Link>
          ))}
        </div>
      </section>

      {/* 004 Why Clickit */}
      <section className="section" id="features" style={{ borderTop: '1px solid var(--line)' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 80, alignItems: 'start' }}>
          <div>
            <div className="section-eyebrow">003 · Why Clickit</div>
            <h2 className="section-title">Slow TV for fast cities.</h2>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
            {features.map((f) => (
              <div
                key={f.n}
                style={{ display: 'grid', gridTemplateColumns: '60px 1fr', gap: 20, paddingBottom: 32, borderBottom: '1px solid var(--line)' }}
              >
                <div className="mono" style={{ fontSize: 13, color: 'var(--accent)' }}>
                  {f.n}
                </div>
                <div>
                  <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 400, margin: '0 0 10px', letterSpacing: '-0.01em' }}>
                    {f.h}
                  </h3>
                  <p style={{ color: 'var(--text-dim)', margin: 0, fontSize: 15, lineHeight: 1.55 }}>{f.b}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 005 Genre tiles */}
      {genres.length > 0 && (
        <section className="section" style={{ borderTop: '1px solid var(--line)' }}>
          <div className="section-eyebrow">004 · Genres</div>
          <h2 className="section-title">Pick a pillar.</h2>
          <div className="genre-grid">
            {genres.map((g) => (
              <Link key={g.name} href={`/browse?genre=${encodeURIComponent(g.name)}`} className="genre-tile">
                <div className="genre-name">{g.name}</div>
                <div className="genre-meta">
                  <span>{g.count} {g.count === 1 ? 'show' : 'shows'}</span>
                  <span className="genre-arrow">→</span>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* 006 FAQ */}
      {faqs.length > 0 && (
        <section className="section" id="faq" style={{ borderTop: '1px solid var(--line)' }}>
          <div className="section-eyebrow">005 · FAQ</div>
          <h2 className="section-title">Common questions.</h2>
          <div className="faq-list">
            {faqs.map((f, i) => (
              <button
                type="button"
                key={i}
                className={`faq-item ${openFaq === i ? 'open' : ''}`}
                onClick={() => setOpenFaq(openFaq === i ? -1 : i)}
              >
                <div className="faq-q">
                  <h3>{f.q}</h3>
                  <div className="faq-toggle">
                    <Icon.Plus size={14} />
                  </div>
                </div>
                <div className="faq-a">
                  <div>
                    <p>{f.a}</p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* 007 CTA banner */}
      {bannerShow && (
        <section className="cta-banner">
          <div className="cta-banner-bg" style={{ backgroundImage: `url(${bannerShow.backdrop})` }} />
          <div className="cta-banner-scrim" />
          <div className="cta-banner-inner">
            <div className="section-eyebrow" style={{ color: 'var(--accent)' }}>
              Start watching
            </div>
            <h2>Free. No card. Bilingual.</h2>
            <p>Open the catalog and start an episode. Everything works on phone, tablet, and TV.</p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              <Link href="/browse" className="btn btn-primary btn-lg">
                Open catalog
              </Link>
              <Link href="/auth" className="btn btn-outline btn-lg">
                Create account
              </Link>
            </div>
          </div>
        </section>
      )}

      <EditorialFooter />
    </div>
  )
}
