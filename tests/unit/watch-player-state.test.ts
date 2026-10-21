import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  REPORTABLE_PLAYER_ERRORS,
  classifyPlayerError,
  errorCardFor,
} from '../../src/lib/watch/player-errors.ts'
import {
  ENDED_MODE,
  UPNEXT_SECONDS,
  barView,
  endedEffects,
  endedReducer,
  isVisibleEnough,
  playerHidden,
} from '../../src/lib/watch/ended-state.ts'
import type { EndedState } from '../../src/lib/watch/ended-state.ts'
import { buildPlayerVars } from '../../src/lib/watch/player-vars.ts'
import { playerIframeHidden } from '../../src/lib/watch/player-dom.ts'

// ---------------------------------------------------------------- errors

test('153 is a site problem and is never reportable', () => {
  assert.deepEqual(classifyPlayerError(153), {
    reportable: false,
    reasonKey: 'errorReasonSite',
    primary: 'tryAgain',
    site: true,
  })
})

test('reportable codes are the allow-list and nothing else', () => {
  assert.deepEqual([...REPORTABLE_PLAYER_ERRORS], [2, 5, 100, 101, 150])
  for (const code of REPORTABLE_PLAYER_ERRORS) {
    assert.equal(classifyPlayerError(code).reportable, true, String(code))
    assert.equal(classifyPlayerError(code).site, false, String(code))
  }
  for (const code of [153, 0, 3, 99, 500, -1, Number.NaN]) {
    assert.equal(classifyPlayerError(code).reportable, false, String(code))
  }
  // unknown code: generic card, not an episode fault
  assert.equal(classifyPlayerError(500).reasonKey, 'errorReasonGeneric')
  assert.equal(classifyPlayerError(500).site, false)
})

test('errorCardFor maps code and stored status to the UI-SPEC reason key', () => {
  const reason = (code: number | null, storedStatus: Parameters<typeof errorCardFor>[0]['storedStatus']) =>
    errorCardFor({ code, storedStatus, hasNext: true }).reasonKey
  assert.equal(reason(100, 'private'), 'errorReasonPrivate')
  assert.equal(reason(100, 'removed'), 'errorReasonRemoved')
  assert.equal(reason(100, null), 'errorReasonRemoved')
  assert.equal(reason(100, 'ok'), 'errorReasonRemoved')
  for (const code of [101, 150]) {
    assert.equal(reason(code, 'not_embeddable'), 'errorReasonNotEmbeddable')
    assert.equal(reason(code, 'private'), 'errorReasonPrivate')
    assert.equal(reason(code, null), 'errorReasonUnavailable')
    assert.equal(reason(code, 'ok'), 'errorReasonUnavailable')
  }
  assert.equal(reason(2, 'ok'), 'errorReasonBadLink')
  assert.equal(reason(2, 'private'), 'errorReasonBadLink')
  assert.equal(reason(5, 'ok'), 'errorReasonPlayback')
  assert.equal(reason(153, 'ok'), 'errorReasonSite')
  assert.equal(reason(999, 'ok'), 'errorReasonGeneric')
  assert.equal(reason(null, null), 'errorReasonGeneric')
})

test('errorCardFor buttons follow the table', () => {
  const play = errorCardFor({ code: 100, storedStatus: null, hasNext: true })
  assert.equal(play.primary, 'playNextEpisode')
  assert.equal(play.secondary, 'backToShow')
  assert.equal(play.reportable, true)
  const five = errorCardFor({ code: 5, storedStatus: null, hasNext: true })
  assert.equal(five.primary, 'tryAgain')
  assert.equal(five.secondary, 'backToShow')
  const site = errorCardFor({ code: 153, storedStatus: null, hasNext: true })
  assert.equal(site.primary, 'tryAgain')
  assert.equal(site.reportable, false)
  assert.equal(site.site, true)
})

test('errorCardFor: preflight blocked_ae is the UAE card and is never reported', () => {
  const card = errorCardFor({ code: null, storedStatus: 'blocked_ae', hasNext: true })
  assert.equal(card.reasonKey, 'errorReasonUae')
  assert.equal(card.reportable, false)
  assert.equal(card.primary, 'playNextEpisode')
})

test('errorCardFor with no next episode makes Back to show the primary', () => {
  for (const code of [100, 101, 2, null]) {
    const card = errorCardFor({ code, storedStatus: 'blocked_ae', hasNext: false })
    assert.equal(card.primary, 'backToShow')
    assert.equal(card.secondary, null)
  }
  const retry = errorCardFor({ code: 5, storedStatus: null, hasNext: false })
  assert.equal(retry.primary, 'tryAgain')
  assert.equal(retry.secondary, 'backToShow')
  const all = [
    errorCardFor({ code: 100, storedStatus: null, hasNext: false }),
    errorCardFor({ code: 153, storedStatus: null, hasNext: false }),
  ]
  for (const card of all) {
    assert.notEqual(card.primary, 'playNextEpisode')
    assert.notEqual(card.secondary, 'playNextEpisode')
  }
})

// ----------------------------------------------------------------- ended

const PLAYING: EndedState = { kind: 'playing' }
const ended = (hasNext: boolean, reducedMotion = false) =>
  ({ type: 'ended', hasNext, reducedMotion }) as const

test('ENDED_MODE ships as bar', () => {
  assert.equal(ENDED_MODE, 'bar')
  assert.equal(UPNEXT_SECONDS, 8)
})

for (const mode of ['bar', 'card'] as const) {
  test(`${mode}: ended with a next episode counts down from 8`, () => {
    const r = endedReducer(mode, PLAYING, ended(true), true)
    assert.deepEqual(r.state, { kind: 'upnext', secondsLeft: 8, counting: true, reduced: false })
    assert.equal(r.advance, false)
  })

  test(`${mode}: tick decrements only while visible and advances at 1`, () => {
    let s: EndedState = endedReducer(mode, PLAYING, ended(true), true).state
    s = endedReducer(mode, s, { type: 'tick' }, true).state
    assert.equal(s.kind === 'upnext' && s.secondsLeft, 7)
    // hidden: paused
    const paused = endedReducer(mode, s, { type: 'tick' }, false)
    assert.deepEqual(paused.state, s)
    assert.equal(paused.advance, false)
    // run down to 1, then the next tick advances
    for (let i = 7; i > 1; i--) {
      const r = endedReducer(mode, s, { type: 'tick' }, true)
      assert.equal(r.advance, false)
      s = r.state
    }
    assert.equal(s.kind === 'upnext' && s.secondsLeft, 1)
    const last = endedReducer(mode, s, { type: 'tick' }, true)
    assert.deepEqual(last.state, { kind: 'playing' })
    assert.equal(last.advance, true)
  })

  test(`${mode}: tick at 1 while hidden does not advance`, () => {
    const s: EndedState = { kind: 'upnext', secondsLeft: 1, counting: true, reduced: false }
    const r = endedReducer(mode, s, { type: 'tick' }, false)
    assert.deepEqual(r.state, s)
    assert.equal(r.advance, false)
  })

  test(`${mode}: visibility events never change the state themselves`, () => {
    const s: EndedState = { kind: 'upnext', secondsLeft: 5, counting: true, reduced: false }
    assert.deepEqual(endedReducer(mode, s, { type: 'visibility', visible: false }, false).state, s)
    assert.deepEqual(endedReducer(mode, s, { type: 'visibility', visible: true }, true).state, s)
  })

  test(`${mode}: cancel (Esc) stops the countdown`, () => {
    const s = endedReducer(mode, PLAYING, ended(true), true).state
    const r = endedReducer(mode, s, { type: 'cancel' }, true)
    assert.deepEqual(r.state, { kind: 'cancelled' })
    assert.equal(r.advance, false)
    // ticks after cancel do nothing
    assert.deepEqual(endedReducer(mode, r.state, { type: 'tick' }, true).state, { kind: 'cancelled' })
  })

  test(`${mode}: playNow advances from up-next and from cancelled`, () => {
    const up: EndedState = { kind: 'upnext', secondsLeft: 4, counting: true, reduced: false }
    const a = endedReducer(mode, up, { type: 'playNow' }, true)
    assert.deepEqual(a.state, { kind: 'playing' })
    assert.equal(a.advance, true)
    const b = endedReducer(mode, { kind: 'cancelled' }, { type: 'playNow' }, true)
    assert.equal(b.advance, true)
  })

  test(`${mode}: no next episode is series-end`, () => {
    const r = endedReducer(mode, PLAYING, ended(false), true)
    assert.deepEqual(r.state, { kind: 'series-end' })
    assert.equal(r.advance, false)
    // Esc on series-end changes nothing
    assert.deepEqual(endedReducer(mode, r.state, { type: 'cancel' }, true).state, { kind: 'series-end' })
  })

  test(`${mode}: error event, and switch from any state returns to playing`, () => {
    const err = endedReducer(mode, PLAYING, { type: 'error', code: 100, storedStatus: 'private' }, true)
    assert.deepEqual(err.state, { kind: 'error', code: 100, storedStatus: 'private' })
    assert.equal(err.advance, false)
    // nothing but switch leaves the error state
    assert.deepEqual(endedReducer(mode, err.state, { type: 'tick' }, true).state, err.state)
    assert.deepEqual(endedReducer(mode, err.state, ended(true), true).state, err.state)
    const states: EndedState[] = [
      PLAYING,
      { kind: 'upnext', secondsLeft: 3, counting: true, reduced: false },
      { kind: 'cancelled' },
      { kind: 'series-end' },
      err.state,
    ]
    for (const s of states) {
      const r = endedReducer(mode, s, { type: 'switch' }, true)
      assert.deepEqual(r.state, { kind: 'playing' })
      assert.equal(r.advance, false)
    }
  })

  test(`${mode}: watchAgain leaves cancelled and series-end for playing`, () => {
    for (const s of [{ kind: 'cancelled' }, { kind: 'series-end' }] as EndedState[]) {
      const r = endedReducer(mode, s, { type: 'watchAgain' }, true)
      assert.deepEqual(r.state, { kind: 'playing' })
      assert.equal(r.advance, false)
    }
  })
}

test('reduced motion: bar opens static, never counts, never advances', () => {
  const r = endedReducer('bar', PLAYING, ended(true, true), true)
  assert.deepEqual(r.state, { kind: 'upnext', secondsLeft: 8, counting: false, reduced: true })
  for (let i = 0; i < 20; i++) {
    const t = endedReducer('bar', r.state, { type: 'tick' }, true)
    assert.deepEqual(t.state, r.state)
    assert.equal(t.advance, false)
  }
  // Play now still works
  assert.equal(endedReducer('bar', r.state, { type: 'playNow' }, true).advance, true)
})

test('reduced motion: card opens directly in cancelled', () => {
  const r = endedReducer('card', PLAYING, ended(true, true), true)
  assert.deepEqual(r.state, { kind: 'cancelled' })
  assert.equal(r.advance, false)
})

test('endedEffects: bar leaves the player running, card stops and hides it', () => {
  const upnext: EndedState = { kind: 'upnext', secondsLeft: 8, counting: true, reduced: false }
  const seriesEnd: EndedState = { kind: 'series-end' }
  const error: EndedState = { kind: 'error', code: 100, storedStatus: null }
  assert.deepEqual(endedEffects('bar', PLAYING, upnext), { stop: false, hide: false })
  assert.deepEqual(endedEffects('bar', PLAYING, seriesEnd), { stop: false, hide: false })
  assert.deepEqual(endedEffects('card', PLAYING, upnext), { stop: true, hide: true })
  assert.deepEqual(endedEffects('card', PLAYING, seriesEnd), { stop: true, hide: true })
  for (const mode of ['bar', 'card'] as const) {
    for (const prev of [PLAYING, upnext, seriesEnd, error]) {
      assert.deepEqual(endedEffects(mode, prev, error), { stop: true, hide: true })
    }
  }
  // card: already hidden and still hidden -> keep hidden, nothing to stop again
  assert.deepEqual(endedEffects('card', upnext, { kind: 'cancelled' }), { stop: false, hide: true })
  // un-hide when leaving the card
  assert.deepEqual(endedEffects('card', { kind: 'cancelled' }, PLAYING), { stop: false, hide: false })
  assert.deepEqual(endedEffects('bar', upnext, PLAYING), { stop: false, hide: false })
})

test('playerHidden per mode', () => {
  const states: EndedState[] = [
    PLAYING,
    { kind: 'upnext', secondsLeft: 8, counting: true, reduced: false },
    { kind: 'cancelled' },
    { kind: 'series-end' },
    { kind: 'error', code: 2, storedStatus: null },
  ]
  assert.deepEqual(
    states.map((s) => playerHidden('bar', s)),
    [false, false, false, false, true]
  )
  assert.deepEqual(
    states.map((s) => playerHidden('card', s)),
    [false, true, true, true, true]
  )
})

test('barView', () => {
  assert.equal(barView(PLAYING), 'normal')
  assert.equal(barView({ kind: 'upnext', secondsLeft: 8, counting: true, reduced: false }), 'upnext-counting')
  assert.equal(barView({ kind: 'upnext', secondsLeft: 8, counting: false, reduced: true }), 'upnext-static')
  assert.equal(barView({ kind: 'cancelled' }), 'finished')
  assert.equal(barView({ kind: 'series-end' }), 'series-end')
  assert.equal(barView({ kind: 'error', code: 2, storedStatus: null }), 'normal')
})

test('isVisibleEnough: at least half the box', () => {
  assert.equal(isVisibleEnough(0.5), true)
  assert.equal(isVisibleEnough(0.49), false)
  assert.equal(isVisibleEnough(1), true)
  assert.equal(isVisibleEnough(0), false)
  assert.equal(isVisibleEnough(Number.NaN), false)
})

// ------------------------------------------------------------------- dom

test('playerIframeHidden is true exactly when no iframe is laid out', () => {
  assert.equal(playerIframeHidden(null), true)
  assert.equal(playerIframeHidden({ querySelector: () => null }), true)
  assert.equal(playerIframeHidden({ querySelector: () => ({ offsetParent: null }) }), true)
  assert.equal(playerIframeHidden({ querySelector: () => ({ offsetParent: {} }) }), false)
  let asked = ''
  playerIframeHidden({
    querySelector: (sel) => {
      asked = sel
      return null
    },
  })
  assert.equal(asked, 'iframe')
})

// ----------------------------------------------------------------- vars

test('buildPlayerVars: English adds captions, Arabic does not', () => {
  const en = buildPlayerVars({ locale: 'en', start: 552, origin: 'https://www.clickitstory.ae' })
  assert.deepEqual(en, {
    autoplay: 0,
    controls: 1,
    rel: 0,
    playsinline: 1,
    enablejsapi: 1,
    iv_load_policy: 3,
    origin: 'https://www.clickitstory.ae',
    hl: 'en',
    cc_load_policy: 1,
    cc_lang_pref: 'en',
    start: 552,
  })
  const ar = buildPlayerVars({ locale: 'ar', start: 552, origin: 'https://www.clickitstory.ae' })
  assert.equal(ar.hl, 'ar')
  assert.equal('cc_load_policy' in ar, false)
  assert.equal('cc_lang_pref' in ar, false)
  assert.equal(ar.start, 552)
})

test('buildPlayerVars omits start at 0, undefined or unusable', () => {
  for (const start of [0, undefined, -5, Number.NaN]) {
    const v = buildPlayerVars({ locale: 'en', start, origin: 'https://x.test' })
    assert.equal('start' in v, false, String(start))
  }
  assert.equal(buildPlayerVars({ locale: 'en', start: 12.9, origin: 'https://x.test' }).start, 12)
})
