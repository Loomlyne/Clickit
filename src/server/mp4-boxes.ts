// MP4 top-level box walker for the Worker (plan 02-16, MEDIA-05). Same algorithm as
// scripts/media/faststart.mjs (plan 02-08). Pure: works only on the bytes it is given
// (finalize passes the first 4 MiB of the object, never the whole file). No '@/' or
// server-only imports: node --test loads this file.

export type Mp4Box = { type: string; offset: number; size: number; toEnd?: boolean }

/** A malformed file must not keep the walker busy: it stops after this many boxes. */
export const MAX_TOP_LEVEL_BOXES = 64

const decoder = new TextDecoder('latin1')

/**
 * Top-level boxes in `bytes`. Stops on a box smaller than its own header, on a
 * truncated header, on a 64-bit size that is not a usable number, after a box that
 * runs to the end of the file, and after MAX_TOP_LEVEL_BOXES boxes. A box whose
 * declared size runs past the given bytes is still listed (a huge `mdat` usually does).
 */
export function topLevelBoxes(bytes: Uint8Array): Mp4Box[] {
  const boxes: Mp4Box[] = []
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  let offset = 0
  while (offset + 8 <= bytes.length && boxes.length < MAX_TOP_LEVEL_BOXES) {
    let size = view.getUint32(offset)
    const type = decoder.decode(bytes.subarray(offset + 4, offset + 8))
    let toEnd = false
    if (size === 1) {
      if (offset + 16 > bytes.length) break
      const large = view.getBigUint64(offset + 8)
      if (large < 16n || large > BigInt(Number.MAX_SAFE_INTEGER)) break
      size = Number(large)
    } else if (size === 0) {
      size = bytes.length - offset
      toEnd = true
    } else if (size < 8) {
      break
    }
    boxes.push(toEnd ? { type, offset, size, toEnd } : { type, offset, size })
    if (toEnd) break
    offset += size
  }
  return boxes
}

/**
 * true: moov before mdat (fast-start). false: mdat before moov. null: neither box
 * is inside the given bytes, so fast-start cannot be proven.
 */
export function isFaststart(bytes: Uint8Array): boolean | null {
  for (const box of topLevelBoxes(bytes)) {
    if (box.type === 'moov') return true
    if (box.type === 'mdat') return false
  }
  return null
}

/**
 * The bytes of the first top-level `moov` box, or null when there is none. When the
 * box runs past the given bytes, what is available is returned (a marker scan on a
 * partial moov can still find a sound track).
 */
export function moovBytes(bytes: Uint8Array): Uint8Array | null {
  for (const box of topLevelBoxes(bytes)) {
    if (box.type === 'moov') {
      return bytes.subarray(box.offset, Math.min(bytes.length, box.offset + box.size))
    }
  }
  return null
}
