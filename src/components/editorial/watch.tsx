'use client'

import Link from 'next/link'
import { Icon } from './primitives/icons'
import { EditorialFooter } from './primitives/footer'
import type { EditorialShow, EditorialEpisode } from '@/lib/editorial/adapter'

export type WatchProps = {
  show: EditorialShow
  episode: EditorialEpisode
  // The existing YouTube IFrame API player. Editorial only wraps its chrome.
  // Expect a pre-rendered ReactNode so we don't couple to the client hook.
  playerSlot: React.ReactNode
  // Optional side ads / up-next card
  upNext?: EditorialEpisode | null
}

/**
 * Editorial watch page — YouTube-style layout.
 * Player on top; metadata below; then Up-Next card; then full episode list.
 * Ported from Clickit- handoff/project/src/watch.jsx.
 *
 * The actual playback (YouTube IFrame API with getCurrentTime/getDuration
 * progress tracking) is handled by the existing app player component, passed
 * in via `playerSlot`. Editorial only reskins the surrounding chrome.
 */
export function EditorialWatch({ show, episode, playerSlot, upNext }: WatchProps) {
  const otherEps = show.episodeList.filter((e) => e.id !== episode.id)

  return (
    <div className="yt-watch page-enter">
      {/* Slim top bar — page scrolls like YouTube */}
      <div className="yt-header">
        <Link href={`/series/${show.slug}`} className="back-btn" aria-label="Back to show">
          <Icon.Back />
        </Link>
        <div className="breadcrumb">
          <Link href={`/series/${show.slug}`} style={{ cursor: 'pointer' }}>
            {show.title}
          </Link>
          <span className="sep">›</span>
          <span>Season 1</span>
          <span className="sep">›</span>
          <span className="cur">
            E{String(episode.num).padStart(2, '0')} · {episode.title}
          </span>
        </div>
        <div style={{ marginLeft: 'auto' }}>
          <Link href={`/series/${show.slug}`} className="btn btn-outline btn-sm">
            Back to show
          </Link>
        </div>
      </div>

      <div className="yt-layout">
        {/* LEFT: player + metadata */}
        <div className="yt-main">
          <div className="yt-player" style={{ aspectRatio: '16 / 9', background: '#000', overflow: 'hidden', borderRadius: 6 }}>
            {playerSlot}
          </div>

          <div style={{ marginTop: 20 }}>
            <div className="mono" style={{ color: 'var(--accent)', marginBottom: 8 }}>
              {show.title.toUpperCase()} · SEASON 1 · EPISODE {episode.num}
            </div>
            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 32, fontWeight: 400, margin: '0 0 10px', letterSpacing: '-0.01em' }}>
              {episode.title}
            </h1>
            <div
              className="hero-meta"
              style={{ fontSize: 11, marginBottom: 18 }}
            >
              <span>{episode.runtime}</span>
              <span className="sep" />
              <span>{show.genre}</span>
              <span className="sep" />
              <span>{show.rating}</span>
            </div>
            <p
              style={{ color: 'var(--text-dim)', fontSize: 15, lineHeight: 1.6, margin: 0, maxWidth: 720 }}
            >
              {episode.description}
            </p>
          </div>
        </div>

        {/* RIGHT: Up Next card + episode list */}
        <aside className="yt-side">
          {upNext && (
            <div className="up-next-card">
              <div className="label" style={{ color: 'var(--accent)', marginBottom: 10 }}>
                Up next
              </div>
              <Link
                href={`/watch/${upNext.id}`}
                style={{ display: 'block', textDecoration: 'none', color: 'inherit' }}
              >
                <div style={{ aspectRatio: '16/9', overflow: 'hidden', borderRadius: 4, marginBottom: 10, background: 'var(--bg-2)' }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={upNext.thumb}
                    alt={upNext.title}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                </div>
                <div className="mono" style={{ marginBottom: 6 }}>
                  Episode {upNext.num} · {upNext.runtime}
                </div>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 20, letterSpacing: '-0.01em', marginBottom: 4 }}>
                  {upNext.title}
                </div>
                <div style={{ color: 'var(--text-dim)', fontSize: 13 }}>{upNext.description}</div>
              </Link>
            </div>
          )}

          <div style={{ marginTop: 24 }}>
            <div className="label" style={{ marginBottom: 12 }}>
              More episodes
            </div>
            <div className="episode-list">
              {otherEps.map((ep) => (
                <Link
                  key={ep.id}
                  href={`/watch/${ep.id}`}
                  className="episode-row"
                  style={{ padding: '10px 0' }}
                >
                  <div className="episode-num">{String(ep.num).padStart(2, '0')}</div>
                  <div className="episode-thumb-wrap">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={ep.thumb} alt={ep.title} />
                  </div>
                  <div>
                    <h3 className="episode-title" style={{ fontSize: 14 }}>{ep.title}</h3>
                  </div>
                  <div className="episode-runtime">{ep.runtime}</div>
                </Link>
              ))}
            </div>
          </div>
        </aside>
      </div>

      <EditorialFooter />
    </div>
  )
}
