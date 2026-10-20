// Navbar hide-on-scroll logic, kept free of React so it can be unit tested.

/** Past this, the navbar switches to its "scrolled" look. */
export const NAV_SCROLLED_Y = 24
/** Within this distance of the top the navbar is always shown. */
export const NAV_TOP_ZONE_Y = 80
/** Smallest per-frame movement that counts as a direction change. */
export const NAV_DIRECTION_DELTA = 4

/** How long after markProgrammaticScroll() scroll samples are not the user's. */
export const PROGRAMMATIC_SCROLL_MS = 200

let programmaticUntil = 0

/**
 * Call right before a scroll the user did not make (scroll restore, the shorts
 * overlay unlocking the body). For the next few frames the navbar only moves
 * its reference point and keeps its hidden/shown state.
 */
export function markProgrammaticScroll(now: number = performance.now()) {
  programmaticUntil = now + PROGRAMMATIC_SCROLL_MS
}

export function isProgrammaticScroll(now: number = performance.now()) {
  return now < programmaticUntil
}

export type NavHideInput = {
  y: number
  lastY: number
  hidden: boolean
  isLanding: boolean
  viewportHeight: number
  /** True while a markProgrammaticScroll() window is open. */
  programmatic?: boolean
}

/**
 * Next hidden state for one scroll sample: hide going down, show going up.
 * Programmatic scrolls (marked ones, and any jump of a full viewport or more
 * inside one frame, e.g. anchor jumps) are not the user's, so they leave the
 * navbar as it was.
 */
export function nextNavHidden({
  y,
  lastY,
  hidden,
  isLanding,
  viewportHeight,
  programmatic = false,
}: NavHideInput): boolean {
  if (isLanding) return false
  if (y < NAV_TOP_ZONE_Y) return false
  if (programmatic) return hidden
  const delta = y - lastY
  if (Math.abs(delta) >= viewportHeight) return hidden
  if (delta > NAV_DIRECTION_DELTA) return true
  if (delta < -NAV_DIRECTION_DELTA) return false
  return hidden
}

type ScrollTarget = Pick<
  Window,
  | 'addEventListener'
  | 'removeEventListener'
  | 'requestAnimationFrame'
  | 'cancelAnimationFrame'
  | 'scrollY'
>

/**
 * One passive scroll listener that reports the scroll position at most once
 * per frame. Returns the unsubscribe function.
 */
export function subscribeNavScroll(
  target: ScrollTarget,
  onFrame: (y: number) => void
): () => void {
  let frame = 0
  const run = () => {
    frame = 0
    onFrame(target.scrollY)
  }
  const onScroll = () => {
    if (!frame) frame = target.requestAnimationFrame(run)
  }
  target.addEventListener('scroll', onScroll, { passive: true })
  return () => {
    target.removeEventListener('scroll', onScroll)
    if (frame) target.cancelAnimationFrame(frame)
  }
}
