// YT.Player playerVars (D-12, RESEARCH Code Example 3). Pure.
//
// `start` replaces the old onReady seekTo, which autoplays from the cued state.
// English asks for English captions; Arabic sets only `hl` (D-12).

export type PlayerVars = {
  autoplay: 0
  controls: 1
  rel: 0
  playsinline: 1
  enablejsapi: 1
  iv_load_policy: 3
  origin: string
  hl: string
  cc_load_policy?: 1
  cc_lang_pref?: 'en'
  start?: number
}

export function buildPlayerVars(input: {
  locale: string
  start?: number
  origin: string
}): PlayerVars {
  const { locale, start, origin } = input
  const vars: PlayerVars = {
    autoplay: 0,
    controls: 1,
    rel: 0,
    playsinline: 1,
    enablejsapi: 1,
    iv_load_policy: 3,
    origin,
    hl: locale,
  }
  if (locale === 'en') {
    vars.cc_load_policy = 1
    vars.cc_lang_pref = 'en'
  }
  if (typeof start === 'number' && Number.isFinite(start) && start >= 1) {
    vars.start = Math.floor(start)
  }
  return vars
}
