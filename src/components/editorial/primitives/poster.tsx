'use client'

import Link from 'next/link'
import { Icon } from './icons'
import type { EditorialShow } from '@/lib/editorial/adapter'

type PosterProps = {
  show: EditorialShow
  landscape?: boolean
  showProgress?: boolean
  badge?: string | null
  href?: string
  inList?: boolean
  onToggleList?: (id: string) => void
}

/**
 * Editorial poster/tile — portrait (2:3) by default, landscape (16:9) opt-in.
 * Hover reveals overlay with Play + My-list buttons and meta.
 * Ported from components.jsx Poster().
 */
export function EditorialPoster({
  show,
  landscape = false,
  showProgress = false,
  badge = null,
  href,
  inList = false,
  onToggleList,
}: PosterProps) {
  const linkHref = href ?? `/series/${show.slug}`
  const displayBadge = badge ?? (show.new ? 'New' : null)

  return (
    <Link href={linkHref} className={`poster${landscape ? ' landscape' : ''}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={show.poster} alt={show.title} loading="lazy" />
      {displayBadge && <div className="poster-badge">{displayBadge}</div>}
      <div className="poster-overlay">
        <h3 className="poster-title">{show.title}</h3>
        <div className="poster-meta">
          {show.genre} · {show.year} · {show.episodes} eps
        </div>
        <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
          <span className="btn btn-primary btn-sm">
            <Icon.Play size={12} /> Play
          </span>
          {onToggleList && (
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                onToggleList(show.id)
              }}
              style={{ background: 'rgba(10,10,10,0.5)' }}
              aria-label={inList ? 'Remove from list' : 'Add to list'}
            >
              {inList ? <Icon.Check size={12} /> : <Icon.Plus size={12} />}
            </button>
          )}
        </div>
      </div>
      {showProgress && show.progress > 0 && (
        <div className="poster-progress">
          <span style={{ width: `${show.progress * 100}%` }} />
        </div>
      )}
    </Link>
  )
}
