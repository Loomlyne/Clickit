// Structural DOM check for the watch shell (06-14). Pure: structural types only,
// no DOM lib types, so it runs under node --test.
//
// While a card replaces the player (the error and blocked_ae cards in both
// modes, the up-next card in 'card' mode) the iframe must not be laid out.
// UAT blocker 3: nothing may sit over a visible player.

export type IframeLookup = {
  querySelector(selector: string): { offsetParent: unknown } | null
}

/** True when no iframe is laid out under `root` (none found, or offsetParent null). */
export function playerIframeHidden(root: IframeLookup | null): boolean {
  if (!root) return true
  const iframe = root.querySelector('iframe')
  if (!iframe) return true
  return iframe.offsetParent === null
}
