'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { EditorialHeader } from './primitives/header'
import { EditorialFooter } from './primitives/footer'
import { EditorialRail } from './primitives/rail'
import { Icon } from './primitives/icons'
import type { EditorialShow } from '@/lib/editorial/adapter'

export type BrowseProps = {
  featuredShows: EditorialShow[]
  continueWatching: EditorialShow[]
  streamingShows: EditorialShow[]
  comingSoonShows: EditorialShow[]
  myList?: string[]
  onToggleList?: (id: string) => void
}

/**
 * Editorial browse (signed-in home).
 * Ported from Clickit- handoff/project/src/browse.jsx.
 *
 * Auto-rotating hero carousel (7s) → rails:
 *   - Continue Watching (if any progress)
 *   - Shorts / Reels strip (9:16)
 *   - Now streaming
 *   - Coming soon
 */
export function EditorialBrowse({
  featuredShows,
  continueWatching,
  streamingShows,
  comingSoonShows,
  myList,
  onToggleList,
}: BrowseProps) {
  const featured = featuredShows.length > 0 ? featuredShows : streamingShows.slice(0, 3)
  const [heroIdx, setHeroIdx] = useState(0)

  useEffect(() => {
    if (featured.length <= 1) return
    const t = setInterval(() => setHeroIdx((i) => (i + 1) % featured.length), 7000)
    return () => clearInterval(t)
  }, [featured.length])

  const current = featured[heroIdx]
  if (!current) {
    return (
      <div className="page-enter">
        <EditorialHeader active="browse" />
        <div style={{ padding: 120, textAlign: 'center', color: 'var(--text-dim)' }}>
          No shows to display yet.
        </div>
        <EditorialFooter />
      </div>
    )
  }

  const shortsSource = streamingShows.slice(0, 8)

  return (
    <div className="page-enter">
      <EditorialHeader active="browse" />

      {/* Hero carousel */}
      <section className="hero">
        <div
          className="hero-bg"
          key={current.id}
          style={{ backgroundImage: `url(${current.backdrop})` }}
        />
        <div className="hero-scrim" />
        <div className="hero-content">
          <div className="hero-eyebrow">
            <span
              style={{
                display: 'inline-block',
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: 'var(--accent)',
              }}
            />
            Featured · {current.genre.toUpperCase()}
          </div>
          <h1 className="hero-title">{current.title}</h1>
          <div className="hero-meta">
            <span>{current.year}</span>
            <span className="sep" />
            <span>{current.rating}</span>
            <span className="sep" />
            <span>{current.episodes} episodes</span>
            <span className="sep" />
            <span>{current.runtime} each</span>
          </div>
          <p className="hero-synopsis">{current.synopsis}</p>
          <div className="hero-actions">
            <Link
              href={`/series/${current.slug}`}
              className="btn btn-primary btn-lg"
            >
              <Icon.Play /> Watch now
            </Link>
            <Link href={`/series/${current.slug}`} className="btn btn-ghost btn-lg">
              <Icon.Info /> More info
            </Link>
            {onToggleList && (
              <button
                type="button"
                className="btn btn-ghost btn-lg"
                onClick={() => onToggleList(current.id)}
              >
                {myList?.includes(current.id) ? <Icon.Check /> : <Icon.Plus />}
                {myList?.includes(current.id) ? 'In list' : 'My list'}
              </button>
            )}
          </div>
        </div>
        {featured.length > 1 && (
          <div className="hero-dots">
            {featured.map((f, i) => (
              <button
                type="button"
                key={f.id}
                className={`hero-dot ${i === heroIdx ? 'active' : ''}`}
                onClick={() => setHeroIdx(i)}
                aria-label={`Show featured ${i + 1}`}
              />
            ))}
          </div>
        )}
      </section>

      {continueWatching.length > 0 && (
        <EditorialRail
          title="Continue Watching"
          eyebrow="Pick up where you left off"
          items={continueWatching}
          landscape
          showProgress
          myList={myList}
          onToggleList={onToggleList}
        />
      )}

      {/* Shorts rail — 9:16 cards */}
      {shortsSource.length > 0 && (
        <section className="rail">
          <div className="rail-header">
            <div>
              <div className="mono" style={{ marginBottom: 6, color: 'var(--accent)' }}>
                Shorts · Quick bites
              </div>
              <h2 className="rail-title">60-second previews</h2>
            </div>
          </div>
          <div
            style={{
              display: 'flex',
              gap: 12,
              overflowX: 'auto',
              paddingBottom: 12,
              scrollbarWidth: 'none',
            }}
          >
            {shortsSource.map((s) => (
              <Link
                key={`short-${s.id}`}
                href={`/series/${s.slug}`}
                style={{
                  position: 'relative',
                  flexShrink: 0,
                  width: 180,
                  aspectRatio: '9/16',
                  borderRadius: 8,
                  overflow: 'hidden',
                  cursor: 'pointer',
                  background: 'var(--bg-2)',
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={s.poster}
                  alt={s.title}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    background: 'linear-gradient(180deg, transparent 50%, rgba(0,0,0,0.9))',
                  }}
                />
                <div
                  style={{
                    position: 'absolute',
                    top: 10,
                    left: 10,
                    fontFamily: 'var(--font-mono)',
                    fontSize: 9,
                    letterSpacing: '0.14em',
                    padding: '3px 6px',
                    background: 'var(--accent)',
                    color: 'var(--accent-fg)',
                    borderRadius: 2,
                  }}
                >
                  SHORT
                </div>
                <div style={{ position: 'absolute', bottom: 12, left: 12, right: 12 }}>
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: 16, lineHeight: 1.15, marginBottom: 4 }}>
                    {s.title}
                  </div>
                  <div className="mono" style={{ fontSize: 9 }}>
                    {s.genre}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      <EditorialRail
        title="Now streaming"
        eyebrow="The full catalog"
        items={streamingShows}
        landscape
        myList={myList}
        onToggleList={onToggleList}
      />

      {comingSoonShows.length > 0 && (
        <EditorialRail
          title="Coming soon"
          eyebrow="Teasers & release dates"
          items={comingSoonShows}
          landscape
          myList={myList}
          onToggleList={onToggleList}
        />
      )}

      <EditorialFooter />
    </div>
  )
}
