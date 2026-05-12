'use client'

import type { ComponentPropsWithoutRef, PointerEvent } from 'react'
import { useRef } from 'react'

import { cn } from '@/lib/utils'

type DragScrollProps = ComponentPropsWithoutRef<'div'> & {
  /**
   * `horizontal` — touch-pan-x (default). Use for rails that scroll horizontally at all breakpoints.
   * `responsive` — touch-auto on small screens, sm:touch-pan-x above. Use when the track is
   * vertical on mobile (e.g. ContentRail) so vertical page scroll is not blocked.
   */
  touchMode?: 'horizontal' | 'responsive'
}

const DRAG_THRESHOLD = 6

export function DragScroll({
  className,
  children,
  touchMode = 'horizontal',
  ...props
}: DragScrollProps) {
  const trackRef = useRef<HTMLDivElement>(null)
  const pointerIdRef = useRef<number | null>(null)
  const startXRef = useRef(0)
  const startScrollLeftRef = useRef(0)
  const dragDistanceRef = useRef(0)

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || event.pointerType === 'touch') return

    const track = trackRef.current
    if (!track || track.scrollWidth <= track.clientWidth) return

    pointerIdRef.current = event.pointerId
    startXRef.current = event.clientX
    startScrollLeftRef.current = track.scrollLeft
    dragDistanceRef.current = 0
  }

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (pointerIdRef.current !== event.pointerId) return

    const track = trackRef.current
    if (!track) return

    const deltaX = event.clientX - startXRef.current
    dragDistanceRef.current = Math.max(
      dragDistanceRef.current,
      Math.abs(deltaX)
    )

    // Defer pointer capture until the user actually drags past the threshold.
    // Capturing on pointerdown reroutes the synthetic click event to this track
    // and prevents child onClick / Link navigation from firing.
    if (
      dragDistanceRef.current > DRAG_THRESHOLD &&
      !track.hasPointerCapture(event.pointerId)
    ) {
      track.setPointerCapture(event.pointerId)
      track.dataset.dragging = 'true'
    }

    track.scrollLeft = startScrollLeftRef.current - deltaX
  }

  const stopDragging = (event: PointerEvent<HTMLDivElement>) => {
    if (pointerIdRef.current !== event.pointerId) return

    const track = trackRef.current
    if (track?.hasPointerCapture(event.pointerId)) {
      track.releasePointerCapture(event.pointerId)
    }
    if (track) {
      delete track.dataset.dragging
    }
    pointerIdRef.current = null
    dragDistanceRef.current = 0
  }

  return (
    <div
      ref={trackRef}
      className={cn(
        'cursor-grab active:cursor-grabbing data-[dragging=true]:select-none',
        touchMode === 'responsive'
          ? 'touch-auto sm:touch-pan-x sm:overscroll-x-contain'
          : 'touch-pan-x overscroll-x-contain',
        className
      )}
      onClickCapture={(event) => {
        if (dragDistanceRef.current < DRAG_THRESHOLD) return

        event.preventDefault()
        event.stopPropagation()
        dragDistanceRef.current = 0
      }}
      onDragStart={(event) => event.preventDefault()}
      onPointerCancel={stopDragging}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={stopDragging}
      {...props}
    >
      {children}
    </div>
  )
}
