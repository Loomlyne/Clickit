import assert from 'node:assert/strict'
import test from 'node:test'
import { nextNavHidden, subscribeNavScroll } from '../../src/lib/nav-scroll.ts'

const base = { hidden: false, isLanding: false, viewportHeight: 800 }

test('nav: hides on a user scroll down, shows on a user scroll up', () => {
  assert.equal(nextNavHidden({ ...base, lastY: 500, y: 540 }), true)
  assert.equal(
    nextNavHidden({ ...base, hidden: true, lastY: 540, y: 500 }),
    false
  )
})

test('nav: always shown near the top and on landing pages', () => {
  assert.equal(nextNavHidden({ ...base, hidden: true, lastY: 0, y: 60 }), false)
  assert.equal(
    nextNavHidden({ ...base, isLanding: true, lastY: 500, y: 600 }),
    false
  )
})

test('nav: a programmatic jump of a viewport or more keeps the current state', () => {
  // Back-button restore / shorts overlay unlock: 0 → 1800 in one frame.
  assert.equal(nextNavHidden({ ...base, lastY: 0, y: 1800 }), false)
  assert.equal(nextNavHidden({ ...base, lastY: 900, y: 1700 }), false)
  assert.equal(
    nextNavHidden({ ...base, hidden: true, lastY: 3000, y: 1200 }),
    true
  )
})

test('nav: tiny movements change nothing', () => {
  assert.equal(nextNavHidden({ ...base, lastY: 500, y: 503 }), false)
  assert.equal(
    nextNavHidden({ ...base, hidden: true, lastY: 500, y: 497 }),
    true
  )
})

function fakeWindow() {
  const listeners = new Map<string, { fn: () => void; opts: unknown }>()
  const frames = new Map<number, () => void>()
  let nextId = 1
  const win = {
    scrollY: 0,
    addEventListener: (type: string, fn: () => void, opts?: unknown) =>
      listeners.set(type, { fn, opts }),
    removeEventListener: (type: string, fn: () => void) => {
      if (listeners.get(type)?.fn === fn) listeners.delete(type)
    },
    requestAnimationFrame: (cb: () => void) => {
      const id = nextId++
      frames.set(id, cb)
      return id
    },
    cancelAnimationFrame: (id: number) => frames.delete(id),
  }
  const flush = () => {
    const pending = [...frames.values()]
    frames.clear()
    pending.forEach((cb) => cb())
  }
  return { win, listeners, frames, flush }
}

test('nav listener: passive, one update per frame, removed on unmount', () => {
  const { win, listeners, frames, flush } = fakeWindow()
  const seen: number[] = []
  const off = subscribeNavScroll(win as never, (y) => seen.push(y))
  assert.deepEqual(listeners.get('scroll')?.opts, { passive: true })

  win.scrollY = 100
  listeners.get('scroll')!.fn()
  win.scrollY = 150
  listeners.get('scroll')!.fn()
  assert.equal(frames.size, 1)
  flush()
  assert.deepEqual(seen, [150])

  listeners.get('scroll')!.fn()
  off()
  assert.equal(listeners.has('scroll'), false)
  assert.equal(frames.size, 0)
})
