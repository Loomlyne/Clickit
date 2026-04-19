'use client'

import Link from 'next/link'
import { useState } from 'react'
import { EditorialHeader } from './primitives/header'
import { EditorialFooter } from './primitives/footer'
import { EditorialRail } from './primitives/rail'
import { Icon } from './primitives/icons'
import type { EditorialShow } from '@/lib/editorial/adapter'

export type SeriesProps = {
  show: EditorialShow
  more: EditorialShow[]
  seasonCount: number
  myList?: string[]
  onToggleList?: (id: string) => void
}

/**
 * Editorial series detail page.
 * Ported from Clickit- handoff/project/src/series.jsx.
 */
export function EditorialSeries({
  show,
  more,
  seasonCount,
  myList,
  onToggleList,
}: SeriesProps) {
  const [season, setSeason] = useState(1)
  const inList = myList?.includes(show.id) ?? false

  return (
    <div className="page-enter">
      <EditorialHeader />

      <section className="series-hero">
        <div
          className="series-hero-bg"
          style={{ backgroundImage: `url(${show.backdrop})` }}
        />
        <div className="series-hero-scrim" />
        <div className="series-hero-content">
          <div className="hero-eyebrow">{show.genre.toUpperCase()} · CLICKIT ORIGINAL</div>
          <h1 className="hero-title" style={{ fontSize: 'clamp(48px, 7vw, 96px)' }}>
            {show.title}
          </h1>
          <p className="hero-synopsis" style={{ fontSize: 17, maxWidth: 620 }}>
            {show.synopsis}
          </p>
          <div className="hero-meta">
            <span>{show.year}</span>
            <span className="sep" />
            <span>{show.rating}</span>
            <span className="sep" />
            <span>{show.episodes} EPS</span>
            <span className="sep" />
            <span>{show.runtime} EACH</span>
          </div>
          <div className="hero-actions" style={{ marginTop: 18 }}>
            {show.episodeList[0] && (
              <Link
                href={`/watch/${show.episodeList[0].id}`}
                className="btn btn-primary btn-lg"
              >
                <Icon.Play /> Play
              </Link>
            )}
            {onToggleList && (
              <button
                type="button"
                className="btn btn-ghost btn-lg"
                onClick={() => onToggleList(show.id)}
              >
                {inList ? <Icon.Check /> : <Icon.Plus />} {inList ? 'In my list' : 'Add to list'}
              </button>
            )}
          </div>
        </div>
      </section>

      <div className="series-content">
        <div className="series-grid">
          <div>
            {/* Episodes */}
            <div style={{ marginBottom: 48 }}>
              {seasonCount > 1 && (
                <div className="season-tabs">
                  {Array.from({ length: seasonCount }).map((_, i) => (
                    <button
                      type="button"
                      key={i}
                      className={`season-tab ${season === i + 1 ? 'active' : ''}`}
                      onClick={() => setSeason(i + 1)}
                    >
                      Season {i + 1}
                    </button>
                  ))}
                </div>
              )}
              <div className="episode-list">
                {show.episodeList.map((ep) => (
                  <Link
                    href={`/watch/${ep.id}`}
                    key={ep.id}
                    className="episode-row"
                  >
                    <div className="episode-num">{String(ep.num).padStart(2, '0')}</div>
                    <div className="episode-thumb-wrap">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={ep.thumb} alt={ep.title} />
                      <div className="episode-play">
                        <div className="episode-play-btn">
                          <Icon.Play size={16} />
                        </div>
                      </div>
                      {ep.progress > 0 && (
                        <div className="poster-progress">
                          <span style={{ width: `${ep.progress * 100}%` }} />
                        </div>
                      )}
                    </div>
                    <div>
                      <h3 className="episode-title">{ep.title}</h3>
                      <p className="episode-desc">{ep.description}</p>
                    </div>
                    <div className="episode-runtime">{ep.runtime}</div>
                  </Link>
                ))}
              </div>
            </div>
          </div>

          {/* Meta sidebar */}
          <aside>
            <div className="label" style={{ marginBottom: 12 }}>Details</div>
            <div className="meta-card">
              <div><div className="label">Year</div><div className="value">{show.year}</div></div>
              <div><div className="label">Rating</div><div className="value">{show.rating}</div></div>
              <div><div className="label">Runtime</div><div className="value">{show.runtime}</div></div>
              <div><div className="label">Genre</div><div className="value">{show.genre}</div></div>
              <div style={{ gridColumn: '1 / -1' }}>
                <div className="label">Creator</div>
                <div className="value">{show.creator}</div>
              </div>
              {show.tagline && (
                <div style={{ gridColumn: '1 / -1' }}>
                  <div className="label">Tagline</div>
                  <div style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 18 }}>
                    &ldquo;{show.tagline}&rdquo;
                  </div>
                </div>
              )}
            </div>
          </aside>
        </div>

        {more.length > 0 && (
          <EditorialRail
            title="More like this"
            eyebrow={`If you enjoyed ${show.title}`}
            items={more}
            myList={myList}
            onToggleList={onToggleList}
          />
        )}
      </div>

      <EditorialFooter />
    </div>
  )
}
