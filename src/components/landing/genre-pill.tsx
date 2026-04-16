'use client'

import { useState } from 'react'

export function GenrePill({ genre }: { genre: string }) {
  const [hovered, setHovered] = useState(false)

  return (
    <div
      className="relative flex cursor-pointer items-center gap-3 overflow-hidden border px-8 py-5 text-sm font-medium tracking-wide transition-all duration-300"
      style={{
        borderColor: hovered ? 'rgba(109,112,241,0.5)' : 'rgba(26,28,35,1)',
        background: hovered
          ? 'linear-gradient(135deg, rgba(109,112,241,0.12) 0%, rgba(0,0,0,0) 100%)'
          : '#0F1115',
        color: hovered ? '#F7FCFF' : 'rgba(255,255,255,0.7)',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <span className="relative z-10 whitespace-nowrap">{genre}</span>
    </div>
  )
}
