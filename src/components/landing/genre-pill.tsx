'use client'

import { useState } from 'react'

export function GenrePill({ genre, color }: { genre: string; color: string }) {
  const [hovered, setHovered] = useState(false)

  return (
    <div
      className="flex cursor-pointer items-center justify-center rounded-full border px-6 py-3.5 text-sm font-medium transition-all duration-300"
      style={{
        borderColor: hovered ? color : 'rgba(255,255,255,0.1)',
        background: hovered ? `${color}18` : 'rgba(255,255,255,0.03)',
        color: hovered ? color : 'rgba(255,255,255,0.7)',
        boxShadow: hovered ? `0 0 24px -6px ${color}66` : 'none',
        transform: hovered ? 'translateY(-3px) scale(1.02)' : 'none',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <span className="whitespace-nowrap">{genre}</span>
    </div>
  )
}
