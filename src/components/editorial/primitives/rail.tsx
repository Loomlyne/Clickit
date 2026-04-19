'use client'

import Link from 'next/link'
import { EditorialPoster } from './poster'
import { Icon } from './icons'
import type { EditorialShow } from '@/lib/editorial/adapter'

type RailProps = {
  title: string
  eyebrow?: string
  items: EditorialShow[]
  landscape?: boolean
  showProgress?: boolean
  viewAllHref?: string
  itemHref?: (show: EditorialShow) => string
  myList?: string[]
  onToggleList?: (id: string) => void
}

/**
 * Horizontal scrolling content rail. Native overflow scroll with scroll-snap.
 * Ported from components.jsx Rail().
 */
export function EditorialRail({
  title,
  eyebrow,
  items,
  landscape = true,
  showProgress = false,
  viewAllHref,
  itemHref,
  myList,
  onToggleList,
}: RailProps) {
  if (items.length === 0) return null

  return (
    <section className="rail">
      <div className="rail-header">
        <div>
          {eyebrow && <div className="mono" style={{ marginBottom: 6 }}>{eyebrow}</div>}
          <h2 className="rail-title">{title}</h2>
        </div>
        {viewAllHref && (
          <Link className="mono" href={viewAllHref} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            View all <Icon.Arrow size={12} />
          </Link>
        )}
      </div>
      <div className="rail-track">
        {items.map((show) => (
          <EditorialPoster
            key={show.id}
            show={show}
            landscape={landscape}
            showProgress={showProgress}
            href={itemHref ? itemHref(show) : undefined}
            inList={myList?.includes(show.id)}
            onToggleList={onToggleList}
          />
        ))}
      </div>
    </section>
  )
}
