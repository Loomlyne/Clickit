// ENDED behaviour of the watch page (D-09, UI-SPEC §4, RESEARCH Pattern 8).
// Pure: the shell (06-14) and the up-next UI (06-10) read this and feed events.
import type { YouTubeStatus } from '../../server/youtube/status'

/**
 * What happens when an episode ends.
 *
 * 'bar'  (shipped default): the iframe and YouTube's own end screen stay visible
 *        and untouched; the control bar under the player turns into the up-next
 *        strip (UI-SPEC §4.2b).
 * 'card' (built alternative): the iframe is stopped and hidden and a Clickit
 *        card replaces it (UI-SPEC §4.2).
 *
 * D-09 as changed by Koss at the plan gate, G1 = B (2026-10-20): 'bar' removes
 * the YouTube Developer Policies Guide risk ("Disabling or blocking Related
 * Video links from appearing after the video completes"). 'card' stays one
 * constant away and is covered by the same tests.
 */
export const ENDED_MODE: 'card' | 'bar' = 'bar'

export type EndedMode = 'card' | 'bar'

/** Countdown length of the up-next ring, in seconds (UI-SPEC §4.2). */
export const UPNEXT_SECONDS = 8

/** Auto-advance only while at least half of the player box is in view (RMF). */
export const MIN_VISIBLE_RATIO = 0.5

export type EndedState =
  | { kind: 'playing' }
  | { kind: 'upnext'; secondsLeft: number; counting: boolean; reduced: boolean }
  | { kind: 'cancelled' }
  | { kind: 'series-end' }
  | { kind: 'error'; code: number | null; storedStatus: YouTubeStatus | null }

export type EndedEvent =
  | { type: 'ended'; hasNext: boolean; reducedMotion: boolean }
  | { type: 'tick' }
  | { type: 'visibility'; visible: boolean }
  | { type: 'cancel' }
  | { type: 'playNow' }
  | { type: 'watchAgain' }
  | { type: 'error'; code: number | null; storedStatus: YouTubeStatus | null }
  | { type: 'switch' }

export type EndedResult = {
  state: EndedState
  /**
   * True when the shell must load the next episode: the countdown reached 0 or
   * the viewer pressed Play now. The state is already 'playing' so the shell
   * un-hides the player before it calls loadVideoById (UI-SPEC §4.1).
   */
  advance: boolean
}

const PLAYING: EndedState = { kind: 'playing' }

/**
 * `visible` is the shell's current visibility flag: player box at least 50% in
 * view and the tab visible. A `visibility` event carries the new value for the
 * shell to store; the reducer itself never changes state on it. The countdown
 * (tick) only moves while `visible` is true and `counting` is true.
 */
export function endedReducer(
  mode: EndedMode,
  state: EndedState,
  event: EndedEvent,
  visible: boolean
): EndedResult {
  const stay: EndedResult = { state, advance: false }

  switch (event.type) {
    case 'switch':
      return { state: PLAYING, advance: false }

    case 'error':
      return {
        state: { kind: 'error', code: event.code, storedStatus: event.storedStatus },
        advance: false,
      }

    case 'ended': {
      if (state.kind === 'error') return stay
      if (!event.hasNext) return { state: { kind: 'series-end' }, advance: false }
      if (event.reducedMotion) {
        // No ring, no auto-advance. The bar shows only Play now; the card
        // opens straight in its cancelled state (Play now / Watch again).
        return {
          state:
            mode === 'bar'
              ? { kind: 'upnext', secondsLeft: UPNEXT_SECONDS, counting: false, reduced: true }
              : { kind: 'cancelled' },
          advance: false,
        }
      }
      return {
        state: { kind: 'upnext', secondsLeft: UPNEXT_SECONDS, counting: true, reduced: false },
        advance: false,
      }
    }

    case 'tick': {
      if (state.kind !== 'upnext' || !state.counting || !visible) return stay
      if (state.secondsLeft <= 1) return { state: PLAYING, advance: true }
      return { state: { ...state, secondsLeft: state.secondsLeft - 1 }, advance: false }
    }

    case 'visibility':
      return stay

    case 'cancel':
      return state.kind === 'upnext' ? { state: { kind: 'cancelled' }, advance: false } : stay

    case 'playNow':
      return state.kind === 'upnext' || state.kind === 'cancelled'
        ? { state: PLAYING, advance: true }
        : stay

    case 'watchAgain':
      return state.kind === 'cancelled' || state.kind === 'series-end'
        ? { state: PLAYING, advance: false }
        : stay
  }
}

/** True when the YouTube container is hidden in this mode and state. */
export function playerHidden(mode: EndedMode, state: EndedState): boolean {
  if (state.kind === 'error') return true
  if (mode === 'bar') return false
  return state.kind === 'upnext' || state.kind === 'cancelled' || state.kind === 'series-end'
}

/**
 * Side effects for a transition. `stop` = call player.stopVideo(), `hide` = hide
 * the container. stopVideo runs once when the player becomes hidden (or on every
 * error, which may repeat), never while only moving between hidden states, and
 * never in 'bar' mode outside an error (the end screen must stay).
 */
export function endedEffects(
  mode: EndedMode,
  prev: EndedState,
  next: EndedState
): { stop: boolean; hide: boolean } {
  if (next.kind === 'error') return { stop: true, hide: true }
  const hide = playerHidden(mode, next)
  return { stop: hide && !playerHidden(mode, prev), hide }
}

export type BarView = 'normal' | 'upnext-counting' | 'upnext-static' | 'finished' | 'series-end'

/** Which face the control bar shows in 'bar' mode (UI-SPEC §4.2b). */
export function barView(state: EndedState): BarView {
  switch (state.kind) {
    case 'upnext':
      return state.counting ? 'upnext-counting' : 'upnext-static'
    case 'cancelled':
      return 'finished'
    case 'series-end':
      return 'series-end'
    default:
      return 'normal'
  }
}

/** IntersectionObserver ratio gate for auto-advance (T-06-19). */
export function isVisibleEnough(ratio: number): boolean {
  return Number.isFinite(ratio) && ratio >= MIN_VISIBLE_RATIO
}
