import assert from 'node:assert/strict'
import { test } from 'node:test'

import { isFaststart, moovBytes, topLevelBoxes } from '../../src/server/mp4-boxes.ts'
import {
  isFaststart as scriptIsFaststart,
  topLevelBoxes as scriptTopLevelBoxes,
} from '../../scripts/media/faststart.mjs'

// Same synthetic buffers as tests/unit/faststart.test.ts (plan 02-08).
function box(type: string, payloadLength: number, opts: { large?: boolean } = {}) {
  const header = opts.large ? 16 : 8
  const bytes = new Uint8Array(header + payloadLength)
  const view = new DataView(bytes.buffer)
  if (opts.large) {
    view.setUint32(0, 1)
    bytes.set(new TextEncoder().encode(type), 4)
    view.setBigUint64(8, BigInt(bytes.length))
  } else {
    view.setUint32(0, bytes.length)
    bytes.set(new TextEncoder().encode(type), 4)
  }
  return bytes
}

function toEnd(type: string, payloadLength: number) {
  const bytes = box(type, payloadLength)
  new DataView(bytes.buffer).setUint32(0, 0)
  return bytes
}

function concat(...parts: Uint8Array[]) {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0))
  let offset = 0
  for (const part of parts) {
    out.set(part, offset)
    offset += part.length
  }
  return out
}

test('02-16 topLevelBoxes walks size/type pairs', () => {
  const bytes = concat(box('ftyp', 12), box('moov', 40), box('mdat', 100))
  assert.deepEqual(
    topLevelBoxes(bytes).map((b) => [b.type, b.offset, b.size]),
    [
      ['ftyp', 0, 20],
      ['moov', 20, 48],
      ['mdat', 68, 108],
    ]
  )
})

test('02-16 topLevelBoxes handles size==1 (64-bit largesize)', () => {
  const bytes = concat(box('ftyp', 4), box('mdat', 30, { large: true }), box('moov', 8))
  const boxes = topLevelBoxes(bytes)
  assert.deepEqual(
    boxes.map((b) => b.type),
    ['ftyp', 'mdat', 'moov']
  )
  assert.equal(boxes[1]!.size, 16 + 30)
})

test('02-16 topLevelBoxes handles size==0 (box runs to the end)', () => {
  const boxes = topLevelBoxes(concat(box('ftyp', 4), toEnd('mdat', 50)))
  assert.equal(boxes.length, 2)
  assert.equal(boxes[1]!.size, 8 + 50)
  assert.equal(boxes[1]!.toEnd, true)
})

test('02-16 topLevelBoxes stops at a truncated or invalid box instead of looping', () => {
  const truncated = concat(box('ftyp', 4), box('mdat', 1000).subarray(0, 40))
  assert.deepEqual(
    topLevelBoxes(truncated).map((b) => b.type),
    ['ftyp', 'mdat']
  )
  const tiny = concat(box('ftyp', 4), new Uint8Array([0, 0, 0, 3, 0x6d, 0x6f, 0x6f, 0x76]))
  assert.equal(topLevelBoxes(tiny).length, 1)
  assert.deepEqual(topLevelBoxes(new Uint8Array(3)), [])
})

test('02-16 topLevelBoxes stops on a 64-bit size that is too small or not a safe number', () => {
  const small = box('mdat', 30, { large: true })
  new DataView(small.buffer).setBigUint64(8, 8n)
  assert.deepEqual(topLevelBoxes(concat(box('ftyp', 4), small)).map((b) => b.type), ['ftyp'])
  const huge = box('mdat', 30, { large: true })
  new DataView(huge.buffer).setBigUint64(8, 0xffffffffffffffffn)
  assert.deepEqual(topLevelBoxes(concat(box('ftyp', 4), huge)).map((b) => b.type), ['ftyp'])
  const cut = box('mdat', 30, { large: true }).subarray(0, 12)
  assert.deepEqual(topLevelBoxes(concat(box('ftyp', 4), cut)).map((b) => b.type), ['ftyp'])
})

test('02-16 topLevelBoxes stops after 64 boxes (T-02-74)', () => {
  const many = concat(...Array.from({ length: 200 }, () => box('free', 0)), box('moov', 8))
  assert.equal(topLevelBoxes(many).length, 64)
  assert.equal(isFaststart(many), null)
})

test('02-16 topLevelBoxes works on a subarray with a byte offset', () => {
  const inner = concat(box('ftyp', 4), box('moov', 10), box('mdat', 10))
  const outer = concat(new Uint8Array(13), inner)
  assert.deepEqual(
    topLevelBoxes(outer.subarray(13)).map((b) => b.type),
    ['ftyp', 'moov', 'mdat']
  )
})

test('02-16 isFaststart: true when moov precedes mdat, false when mdat comes first', () => {
  assert.equal(isFaststart(concat(box('ftyp', 4), box('moov', 40), box('mdat', 100))), true)
  assert.equal(isFaststart(concat(box('ftyp', 4), box('mdat', 100), box('moov', 40))), false)
})

test('02-16 isFaststart: truncated prefixes and missing boxes', () => {
  const faststartPrefix = concat(box('ftyp', 4), box('moov', 30), box('mdat', 1000)).subarray(0, 80)
  assert.equal(isFaststart(faststartPrefix), true)
  const slowPrefix = concat(box('ftyp', 4), box('mdat', 100000)).subarray(0, 64)
  assert.equal(isFaststart(slowPrefix), false)
  assert.equal(isFaststart(concat(box('ftyp', 4), box('free', 20))), null)
  assert.equal(isFaststart(new Uint8Array(0)), null)
})

test('02-16 moovBytes returns the moov box or null', () => {
  const moov = box('moov', 40)
  moov.set([0x73, 0x6f, 0x75, 0x6e], 20)
  const bytes = concat(box('ftyp', 4), moov, box('mdat', 100))
  const got = moovBytes(bytes)
  assert.ok(got)
  assert.equal(got.length, moov.length)
  assert.deepEqual(Array.from(got), Array.from(moov))
  assert.equal(moovBytes(concat(box('ftyp', 4), box('mdat', 100))), null)
  assert.equal(moovBytes(new Uint8Array(0)), null)
})

test('02-16 moovBytes of a moov that runs past the given bytes returns what is there', () => {
  const bytes = concat(box('ftyp', 4), box('moov', 400)).subarray(0, 100)
  const got = moovBytes(bytes)
  assert.ok(got)
  assert.equal(got.length, 100 - 12)
})

test('02-16 the Worker walker agrees with the 02-08 script walker on the same buffers', () => {
  const buffers = [
    concat(box('ftyp', 12), box('moov', 40), box('mdat', 100)),
    concat(box('ftyp', 4), box('mdat', 30, { large: true }), box('moov', 8)),
    concat(box('ftyp', 4), toEnd('mdat', 50)),
    concat(box('ftyp', 4), box('mdat', 100000)).subarray(0, 64),
  ]
  for (const b of buffers) {
    assert.deepEqual(topLevelBoxes(b), scriptTopLevelBoxes(b))
    assert.equal(isFaststart(b), scriptIsFaststart(b))
  }
})
