/** Scan MP4 bytes for a sound track (`soun` handler or `mp4a` sample entry). */
export function mp4BytesHasAudioTrack(data: ArrayBuffer | Uint8Array): boolean {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data)
  if (bytes.length < 8) return false

  const markers = [
    [0x73, 0x6f, 0x75, 0x6e], // soun — sound media handler
    [0x6d, 0x70, 0x34, 0x61], // mp4a — AAC sample description
    [0x61, 0x61, 0x63, 0x20], // aac␠
    [0x61, 0x63, 0x2d, 0x33], // ac-3
  ] as const

  for (const marker of markers) {
    for (let i = 0; i <= bytes.length - marker.length; i++) {
      if (marker.every((byte, j) => bytes[i + j] === byte)) {
        return true
      }
    }
  }

  return false
}

/** Read the head + tail of a local MP4 — moov may live at either end. */
export async function localMp4HasAudioTrack(file: File): Promise<boolean> {
  const chunkSize = 512 * 1024
  const head = await file.slice(0, Math.min(file.size, chunkSize)).arrayBuffer()
  if (mp4BytesHasAudioTrack(head)) return true

  if (file.size <= chunkSize) return false

  const tailStart = Math.max(0, file.size - chunkSize)
  const tail = await file.slice(tailStart, file.size).arrayBuffer()
  return mp4BytesHasAudioTrack(tail)
}
