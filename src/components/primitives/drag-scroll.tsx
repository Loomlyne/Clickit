'use client'

import type { ComponentPropsWithoutRef, PointerEvent } from 'react'
import { useRef } from 'react'

import { cn } from '@/lib/utils'

type DragScrollProps = ComponentPropsWithoutRef<'div'>

const DRAG_THRESHOLD = 6

export function DragScroll({ className, children, ...props }: DragScrollProps) {
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
    track.setPointerCapture(event.pointerId)
    track.dataset.dragging = 'true'
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
        'cursor-grab touch-pan-x overscroll-x-contain active:cursor-grabbing data-[dragging=true]:select-none',
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
