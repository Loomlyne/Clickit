import assert from 'node:assert/strict'
import { test } from 'node:test'

import { isFaststart, topLevelBoxes } from '../../scripts/media/faststart.mjs'

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

test('02-08 topLevelBoxes walks size/type pairs', () => {
  const bytes = concat(box('ftyp', 12), box('moov', 40), box('mdat', 100))
  const boxes = topLevelBoxes(bytes)
  assert.deepEqual(
    boxes.map((b: { type: string; offset: number; size: number }) => [b.type, b.offset, b.size]),
    [
      ['ftyp', 0, 20],
      ['moov', 20, 48],
      ['mdat', 68, 108],
    ]
  )
})

test('02-08 topLevelBoxes handles size==1 (64-bit largesize)', () => {
  const bytes = concat(box('ftyp', 4), box('mdat', 30, { large: true }), box('moov', 8))
  const boxes = topLevelBoxes(bytes)
  assert.deepEqual(
    boxes.map((b: { type: string }) => b.type),
    ['ftyp', 'mdat', 'moov']
  )
  assert.equal(boxes[1].size, 16 + 30)
})

test('02-08 topLevelBoxes handles size==0 (box runs to the end)', () => {
  const bytes = concat(box('ftyp', 4), toEnd('mdat', 50))
  const boxes = topLevelBoxes(bytes)
  assert.equal(boxes.length, 2)
  assert.equal(boxes[1].type, 'mdat')
  assert.equal(boxes[1].size, 8 + 50)
  assert.equal(boxes[1].toEnd, true)
})

test('02-08 topLevelBoxes stops at a truncated or invalid box instead of looping', () => {
  const bytes = concat(box('ftyp', 4), box('mdat', 1000).subarray(0, 40))
  const boxes = topLevelBoxes(bytes)
  assert.deepEqual(
    boxes.map((b: { type: string }) => b.type),
    ['ftyp', 'mdat']
  )
  const garbage = concat(box('ftyp', 4), new Uint8Array([0, 0, 0, 3, 0x6d, 0x6f, 0x6f, 0x76]))
  assert.equal(topLevelBoxes(garbage).length, 1)
  assert.deepEqual(topLevelBoxes(new Uint8Array(3)), [])
})

test('02-08 isFaststart: true when moov precedes mdat', () => {
  assert.equal(isFaststart(concat(box('ftyp', 4), box('moov', 40), box('mdat', 100))), true)
})

test('02-08 isFaststart: false when mdat precedes moov', () => {
  assert.equal(isFaststart(concat(box('ftyp', 4), box('mdat', 100), box('moov', 40))), false)
})

test('02-08 isFaststart: moov first inside a truncated prefix is still true, mdat first with no moov is false', () => {
  const faststartPrefix = concat(box('ftyp', 4), box('moov', 30), box('mdat', 1000)).subarray(0, 80)
  assert.equal(isFaststart(faststartPrefix), true)
  const slowPrefix = concat(box('ftyp', 4), box('mdat', 100000)).subarray(0, 64)
  assert.equal(isFaststart(slowPrefix), false)
})

test('02-08 isFaststart: null when neither moov nor mdat is in the given bytes', () => {
  assert.equal(isFaststart(concat(box('ftyp', 4), box('free', 20))), null)
  assert.equal(isFaststart(new Uint8Array(0)), null)
})
