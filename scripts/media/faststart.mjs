// MP4 top-level box walker (MEDIA-05). Pure: works on the bytes it is given
// (the copy script passes the first 64 KiB). No network, nothing from src/.

const decoder = new TextDecoder('latin1')

/**
 * @param {Uint8Array} bytes
 * @returns {Array<{ type: string, offset: number, size: number, toEnd?: boolean }>}
 */
export function topLevelBoxes(bytes) {
  const boxes = []
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  let offset = 0
  while (offset + 8 <= bytes.length) {
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
 * true: moov before mdat. false: mdat before moov. null: neither box seen.
 * @param {Uint8Array} bytes
 */
export function isFaststart(bytes) {
  for (const box of topLevelBoxes(bytes)) {
    if (box.type === 'moov') return true
    if (box.type === 'mdat') return false
  }
  return null
}
