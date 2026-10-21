// Magic-byte sniffing for uploaded media (MEDIA-06, T-02-53, T-02-54).
// Pure: no imports. The first bytes of the object decide the type; the declared
// Content-Type is only a claim. "text/markup" (SVG, XML, HTML, anything that
// starts with "<") is returned so callers can refuse it everywhere.

export type SniffedType =
  | 'image/jpeg'
  | 'image/png'
  | 'image/webp'
  | 'image/avif'
  | 'image/gif'
  | 'image/x-icon'
  | 'video/mp4'
  | 'text/markup'

// ISO BMFF major brands accepted as an MP4 video. heic/mif1 and QuickTime
// ("qt  ") are deliberately absent.
const MP4_BRANDS = new Set(['isom', 'iso2', 'iso3', 'iso4', 'iso5', 'iso6', 'mp41', 'mp42', 'avc1', 'mmp4', 'M4V '])

function at(bytes: Uint8Array, offset: number, sig: readonly number[]): boolean {
  if (bytes.length < offset + sig.length) return false
  return sig.every((b, i) => bytes[offset + i] === b)
}

function ascii(bytes: Uint8Array, offset: number, len: number): string {
  if (bytes.length < offset + len) return ''
  let s = ''
  for (let i = offset; i < offset + len; i++) s += String.fromCharCode(bytes[i]!)
  return s
}

export function sniffMediaType(bytes: Uint8Array): SniffedType | null {
  if (at(bytes, 0, [0xff, 0xd8, 0xff])) return 'image/jpeg'
  if (at(bytes, 0, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'image/png'
  if (ascii(bytes, 0, 4) === 'RIFF' && ascii(bytes, 8, 4) === 'WEBP') return 'image/webp'
  if (ascii(bytes, 0, 4) === 'GIF8') return 'image/gif'
  if (at(bytes, 0, [0x00, 0x00, 0x01, 0x00])) return 'image/x-icon'
  if (ascii(bytes, 4, 4) === 'ftyp') {
    const brand = ascii(bytes, 8, 4)
    if (brand === 'avif' || brand === 'avis') return 'image/avif'
    if (MP4_BRANDS.has(brand)) return 'video/mp4'
    return null
  }
  let i = 0
  if (at(bytes, 0, [0xef, 0xbb, 0xbf])) i = 3
  while (i < bytes.length && (bytes[i] === 0x20 || bytes[i] === 0x09 || bytes[i] === 0x0a || bytes[i] === 0x0d)) i++
  if (bytes[i] === 0x3c) return 'text/markup'
  return null
}
