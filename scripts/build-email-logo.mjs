// Builds public/brand/email-logo-white.png (Phase 5, plan 05-07 Task 4).
//
// The brand mark (public/brand/cit-story.png, a light mark on transparency) is trimmed,
// fitted into 240x64, centred on an opaque plate that is exactly 272px wide with 16px above
// and below, and flattened onto the email header colour (EMAIL_TOKENS.light.header) so the
// plate is baked into the pixels: no alpha channel, nothing for Gmail dark mode to invert
// into a pale box. Emails show it at width 136 (2x).
//
// Run (Node strips the types of the token import):
//   node --experimental-strip-types --disable-warning=ExperimentalWarning scripts/build-email-logo.mjs
import { statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'
import { EMAIL_TOKENS } from '../src/lib/email-tokens.ts'

const root = fileURLToPath(new URL('..', import.meta.url))
const SOURCE = `${root}public/brand/cit-story.png`
const OUTPUT = `${root}public/brand/email-logo-white.png`

const PLATE = EMAIL_TOKENS.light.header
const WIDTH = 272
const PAD_Y = 16
const MAX_MARK_W = 240
const MAX_MARK_H = 64
const MAX_HEIGHT = 96

function rgbOf(hex) {
  const h = hex.replace('#', '')
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16))
}

const { data: mark, info: markInfo } = await sharp(SOURCE)
  .trim()
  .resize({ width: MAX_MARK_W, height: MAX_MARK_H, fit: 'inside' })
  .toBuffer({ resolveWithObject: true })

const left = Math.floor((WIDTH - markInfo.width) / 2)
const right = WIDTH - markInfo.width - left

const { data: out, info } = await sharp(mark)
  .extend({
    top: PAD_Y,
    bottom: PAD_Y,
    left,
    right,
    background: PLATE,
  })
  .flatten({ background: PLATE })
  .removeAlpha()
  .png({ compressionLevel: 9 })
  .toFile(OUTPUT)
  .then(async (info) => ({ info, data: await sharp(OUTPUT).raw().toBuffer() }))

if (info.width !== WIDTH) throw new Error(`width ${info.width} is not ${WIDTH}`)
if (info.height > MAX_HEIGHT)
  throw new Error(`height ${info.height} is over ${MAX_HEIGHT}`)
if (info.channels !== 3) throw new Error('the PNG still has an alpha channel')

// The plate must show at the corners.
const want = rgbOf(PLATE)
const channels = info.channels
const corners = [0, (info.width - 1) * channels]
const lastRow = (info.height - 1) * info.width * channels
corners.push(lastRow, lastRow + (info.width - 1) * channels)
for (const at of corners) {
  const got = [out[at], out[at + 1], out[at + 2]]
  if (got.some((v, i) => v !== want[i]))
    throw new Error(`corner pixel ${got} is not the plate ${want}`)
}

console.log(
  `email logo: ${info.width}x${info.height}px, ${statSync(OUTPUT).size} bytes -> public/brand/email-logo-white.png`
)
