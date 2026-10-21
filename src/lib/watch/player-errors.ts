// YouTube IFrame player errors to the branded card (D-11, UI-SPEC §4.3,
// RESEARCH Pattern 9). Pure: returns message keys, never English text. Reason
// keys live in the `player` namespace; button keys are `player.tryAgain`,
// `player.playNextEpisode` and `watch.backToShow`.
import type { YouTubeStatus } from '../../server/youtube/status'

export type PlayerReasonKey =
  | 'errorReasonRemoved'
  | 'errorReasonPrivate'
  | 'errorReasonNotEmbeddable'
  | 'errorReasonUnavailable'
  | 'errorReasonUae'
  | 'errorReasonBadLink'
  | 'errorReasonPlayback'
  | 'errorReasonGeneric'
  | 'errorReasonSite'

export type PlayerButtonKey = 'tryAgain' | 'playNextEpisode' | 'backToShow'

/**
 * Codes a viewer's player may report as an episode fault (T-06-17). 153 is
 * deliberately absent: it is a missing Referer, a site problem (Pitfall 6).
 */
export const REPORTABLE_PLAYER_ERRORS = [2, 5, 100, 101, 150] as const

export type PlayerErrorClass = {
  reportable: boolean
  reasonKey: PlayerReasonKey
  primary: 'tryAgain' | 'playNextEpisode'
  site: boolean
}

/** Code-only classification (before the stored status refines the reason). */
export function classifyPlayerError(code: number): PlayerErrorClass {
  switch (code) {
    case 153:
      return { reportable: false, reasonKey: 'errorReasonSite', primary: 'tryAgain', site: true }
    case 100:
      return { reportable: true, reasonKey: 'errorReasonRemoved', primary: 'playNextEpisode', site: false }
    case 101:
    case 150:
      return { reportable: true, reasonKey: 'errorReasonUnavailable', primary: 'playNextEpisode', site: false }
    case 2:
      return { reportable: true, reasonKey: 'errorReasonBadLink', primary: 'playNextEpisode', site: false }
    case 5:
      return { reportable: true, reasonKey: 'errorReasonPlayback', primary: 'tryAgain', site: false }
    default:
      // Unknown codes get the generic card and are not an episode fault.
      return { reportable: false, reasonKey: 'errorReasonGeneric', primary: 'playNextEpisode', site: false }
  }
}

export type ErrorCard = {
  reasonKey: PlayerReasonKey
  primary: PlayerButtonKey
  /** null when there is no second button (Back to show already primary). */
  secondary: 'backToShow' | null
  /** Send a viewer report (D-17). Never for 153, unknown codes or preflight. */
  reportable: boolean
  /** Shows the "We've told the Clickit team" line: only when reported. */
  showReportedLine: boolean
  site: boolean
}

/**
 * The card for a player error (`code`) or a preflight block (`code` null with
 * stored status `blocked_ae`). The stored status only sharpens the reason when
 * it agrees with the code (UI-SPEC §4.3).
 */
export function errorCardFor(input: {
  code: number | null
  storedStatus?: YouTubeStatus | null
  hasNext: boolean
}): ErrorCard {
  const { code, storedStatus, hasNext } = input

  let reasonKey: PlayerReasonKey
  let primary: 'tryAgain' | 'playNextEpisode'
  let reportable: boolean
  let site = false

  if (code === null) {
    // Preflight: the player was never asked to load this episode.
    reasonKey = storedStatus === 'blocked_ae' ? 'errorReasonUae' : 'errorReasonGeneric'
    primary = 'playNextEpisode'
    reportable = false
  } else {
    const base = classifyPlayerError(code)
    reasonKey = base.reasonKey
    primary = base.primary
    reportable = base.reportable
    site = base.site
    if (code === 100 && storedStatus === 'private') reasonKey = 'errorReasonPrivate'
    if (code === 101 || code === 150) {
      if (storedStatus === 'not_embeddable') reasonKey = 'errorReasonNotEmbeddable'
      else if (storedStatus === 'private') reasonKey = 'errorReasonPrivate'
    }
  }

  if (primary === 'playNextEpisode' && !hasNext) {
    return { reasonKey, primary: 'backToShow', secondary: null, reportable, showReportedLine: reportable, site }
  }
  return { reasonKey, primary, secondary: 'backToShow', reportable, showReportedLine: reportable, site }
}
