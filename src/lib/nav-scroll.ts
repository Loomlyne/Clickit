// Navbar hide-on-scroll logic, kept free of React so it can be unit tested.

/** Past this, the navbar switches to its "scrolled" look. */
export const NAV_SCROLLED_Y = 24
/** Within this distance of the top the navbar is always shown. */
export const NAV_TOP_ZONE_Y = 80
/** Smallest per-frame movement that counts as a direction change. */
export const NAV_DIRECTION_DELTA = 4

export type NavHideInput = {
  y: number
  lastY: number
  hidden: boolean
  isLanding: boolean
  viewportHeight: number
}

/**
 * Next hidden state for one scroll sample: hide going down, show going up.
 * A jump of a full viewport or more inside one frame is programmatic (back /
 * forward restore, the shorts overlay unlocking the body, anchor jumps), not
 * a user scroll, so it leaves the navbar as it was.
 */
export function nextNavHidden({
  y,
  lastY,
  hidden,
  isLanding,
  viewportHeight,
}: NavHideInput): boolean {
  if (isLanding) return false
  if (y < NAV_TOP_ZONE_Y) return false
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
