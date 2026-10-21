// Upload kind table for direct-to-R2 uploads (MEDIA-01, MEDIA-06).
// Pure: no '@/' or server-only imports (node --test loads this file).
// Caps, allowlists and messages come from the code they replaced (all deleted in plan 02-19):
//   artwork         src/app/[locale]/admin/actions.ts uploadArtwork (10 MB, logo 2 MB)
//   site-image      uploadSiteImage + SITE_IMAGE_MIME_EXT (5 MB)
//   social-icon     uploadSocialIcon + SOCIAL_ICON_MIME_EXT (2 MB)
//   cast-image      uploadCastImage (2 MB, PNG/JPEG/WebP)
//   avatar          (viewer)/profile/actions.ts uploadAvatar (2 MB, WebP/PNG/JPEG)
//   hero-video / show-video  HERO_VIDEO_MAX_BYTES (50 MB)
//   preloader-video createPreloaderVideoUpload (20 MB)
// SVG is refused on every image kind (Phase 01.1 D-03).

import {
  HERO_VIDEO_MAX_BYTES,
  HERO_VIDEO_TOO_LARGE,
  SITE_IMAGE_MIME_EXT,
  SOCIAL_ICON_MIME_EXT,
  SVG_REJECTED_MESSAGE,
} from '../lib/admin/media-guards.ts'

const MB = 1024 * 1024

export const VARIANT_WIDTHS = [640, 1280, 1920] as const
export type VariantWidth = (typeof VARIANT_WIDTHS)[number]
export const MAX_VARIANT_URLS_PER_CALL = 3

export type UploadKind =
  | 'artwork'
  | 'site-image'
  | 'social-icon'
  | 'cast-image'
  | 'avatar'
  | 'hero-video'
  | 'preloader-video'
  | 'show-video'

export type UploadBucket = 'show-artwork' | 'site-assets' | 'avatars'

type MimeExt = Record<string, string>

const PNG_JPEG_WEBP: MimeExt = { 'image/webp': 'webp', 'image/png': 'png', 'image/jpeg': 'jpg' }
const SITE_IMAGE_NO_ICO: MimeExt = Object.fromEntries(
  Object.entries(SITE_IMAGE_MIME_EXT).filter(([mime]) => mime !== 'image/x-icon')
)
const MP4: MimeExt = { 'video/mp4': 'mp4' }

type KindDef = {
  bucket: UploadBucket
  actor: 'admin' | 'user'
  /** Allowed slot values; empty means the kind takes no slot. */
  slots: readonly string[]
  needsShowId: boolean
  /** Raster originals may have WebP variants (ICO never does). */
  variants: boolean
  video: boolean
  allowed(slot: string | undefined): MimeExt
  capBytes(slot: string | undefined): number
  overCapMessage(slot: string | undefined): string
  badTypeMessage: string
}

const ARTWORK_SLOTS = ['poster', 'card', 'hero', 'hero-mobile', 'logo'] as const
const SITE_IMAGE_SLOTS = ['og', 'favicon', 'favicon-dark', 'auth'] as const
const VIDEO_VARIANT_SLOTS = ['desktop', 'mobile'] as const

export const UPLOAD_KINDS: Record<UploadKind, KindDef> = {
  artwork: {
    bucket: 'show-artwork',
    actor: 'admin',
    slots: ARTWORK_SLOTS,
    needsShowId: true,
    variants: true,
    video: false,
    allowed: () => PNG_JPEG_WEBP,
    capBytes: (slot) => (slot === 'logo' ? 2 * MB : 10 * MB),
    overCapMessage: (slot) => (slot === 'logo' ? 'Image must be under 2MB' : 'Image must be under 10MB'),
    badTypeMessage: 'File must be a WebP, PNG, or JPEG image',
  },
  'site-image': {
    bucket: 'site-assets',
    actor: 'admin',
    slots: SITE_IMAGE_SLOTS,
    needsShowId: false,
    variants: true,
    video: false,
    // ICO only makes sense for the favicons; every other slot stays raster.
    allowed: (slot) => (slot === 'favicon' || slot === 'favicon-dark' ? SITE_IMAGE_MIME_EXT : SITE_IMAGE_NO_ICO),
    capBytes: () => 5 * MB,
    overCapMessage: () => 'Image must be under 5MB',
    badTypeMessage: 'Unsupported image type.',
  },
  'social-icon': {
    bucket: 'site-assets',
    actor: 'admin',
    slots: [],
    needsShowId: false,
    variants: true,
    video: false,
    allowed: () => SOCIAL_ICON_MIME_EXT,
    capBytes: () => 2 * MB,
    overCapMessage: () => 'Icon must be under 2MB',
    badTypeMessage: 'Unsupported image type.',
  },
  'cast-image': {
    bucket: 'show-artwork',
    actor: 'admin',
    slots: [],
    needsShowId: true,
    variants: true,
    video: false,
    allowed: () => PNG_JPEG_WEBP,
    capBytes: () => 2 * MB,
    overCapMessage: () => 'Image must be under 2MB',
    badTypeMessage: 'Only PNG, JPEG, or WebP images are allowed',
  },
  avatar: {
    bucket: 'avatars',
    actor: 'user',
    slots: [],
    needsShowId: false,
    variants: true,
    video: false,
    allowed: () => PNG_JPEG_WEBP,
    capBytes: () => 2 * MB,
    overCapMessage: () => 'File must be under 2MB',
    badTypeMessage: 'Only WebP, PNG, or JPEG images allowed',
  },
  'hero-video': {
    bucket: 'site-assets',
    actor: 'admin',
    slots: VIDEO_VARIANT_SLOTS,
    needsShowId: false,
    variants: false,
    video: true,
    allowed: () => MP4,
    capBytes: () => HERO_VIDEO_MAX_BYTES,
    overCapMessage: () => HERO_VIDEO_TOO_LARGE,
    badTypeMessage: 'File must be an MP4 video',
  },
  'preloader-video': {
    bucket: 'site-assets',
    actor: 'admin',
    slots: [],
    needsShowId: false,
    variants: false,
    video: true,
    allowed: () => MP4,
    capBytes: () => 20 * MB,
    overCapMessage: () => 'Video must be under 20MB',
    badTypeMessage: 'File must be an MP4 video',
  },
  'show-video': {
    bucket: 'site-assets',
    actor: 'admin',
    slots: VIDEO_VARIANT_SLOTS,
    needsShowId: true,
    variants: false,
    video: true,
    allowed: () => MP4,
    capBytes: () => HERO_VIDEO_MAX_BYTES,
    overCapMessage: () => HERO_VIDEO_TOO_LARGE,
    badTypeMessage: 'File must be an MP4 video',
  },
}

export function isUploadKind(value: unknown): value is UploadKind {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(UPLOAD_KINDS, value)
}

const MIME_ALIASES: Record<string, string> = {
  'image/jpg': 'image/jpeg',
  'image/pjpeg': 'image/jpeg',
  'image/vnd.microsoft.icon': 'image/x-icon',
}

/** Lowercase, drop parameters, map aliases. */
export function normalizeContentType(value: unknown): string {
  if (typeof value !== 'string') return ''
  const base = (value.split(';')[0] ?? '').trim().toLowerCase()
  return MIME_ALIASES[base] ?? base
}

function slotOk(def: KindDef, slot: unknown): slot is string | undefined {
  if (def.slots.length === 0) return slot === undefined || slot === null || slot === ''
  return typeof slot === 'string' && def.slots.includes(slot)
}

export type UploadRequestCheck =
  | { ok: true; contentType: string; ext: string; capBytes: number }
  | { ok: false; error: string }

export function checkUploadRequest(input: {
  kind: UploadKind
  slot?: string | null
  contentType: string
  size: number
}): UploadRequestCheck {
  if (!isUploadKind(input.kind)) return { ok: false, error: 'Invalid upload kind' }
  const def = UPLOAD_KINDS[input.kind]
  if (!slotOk(def, input.slot)) return { ok: false, error: 'Invalid slot' }
  const slot = input.slot ? input.slot : undefined

  const contentType = normalizeContentType(input.contentType)
  if (!def.video && contentType === 'image/svg+xml') return { ok: false, error: SVG_REJECTED_MESSAGE }
  const ext = def.allowed(slot)[contentType]
  if (!ext) return { ok: false, error: def.badTypeMessage }

  const size = input.size
  if (typeof size !== 'number' || !Number.isInteger(size) || size <= 0) {
    return { ok: false, error: 'No file provided' }
  }
  const capBytes = def.capBytes(slot)
  if (size > capBytes) return { ok: false, error: def.overCapMessage(slot) }
  return { ok: true, contentType, ext, capBytes }
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
const KEY_CHARS_RE = /^[a-z0-9/_.-]+$/

function cleanId(value: unknown, label: string): string {
  const id = typeof value === 'string' ? value.toLowerCase() : ''
  if (!UUID_RE.test(id)) throw new Error(`Invalid ${label}`)
  return id
}

export type MintInput = {
  slot?: string | null
  showId?: string | null
  userId?: string | null
  contentType: string
  /** Ignored on purpose: a filename never reaches the key. */
  filename?: string
  now?: number
  random?: () => string
}

function defaultRandom(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(4))
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

/** Full R2 object key: `<bucket>/<path>`. Throws on any bad input; never mints a partial key. */
export function mintUploadKey(kind: UploadKind, input: MintInput): string {
  if (!isUploadKind(kind)) throw new Error('Invalid upload kind')
  const def = UPLOAD_KINDS[kind]
  if (!slotOk(def, input.slot)) throw new Error('Invalid slot')
  const slot = input.slot ? input.slot : undefined
  const contentType = normalizeContentType(input.contentType)
  const ext = def.allowed(slot)[contentType]
  if (!ext) throw new Error('Unsupported content type')

  const ts = String(Math.trunc(input.now ?? Date.now()))
  const rand = (input.random ?? defaultRandom)()
  if (!/^[0-9]{10,16}$/.test(ts) || !/^[0-9a-f]{8}$/.test(rand)) throw new Error('Invalid key component')
  const stamp = `${ts}-${rand}`

  let path: string
  switch (kind) {
    case 'artwork':
      path = `shows/${cleanId(input.showId, 'showId')}/${slot}-${stamp}.${ext}`
      break
    case 'cast-image':
      path = `shows/${cleanId(input.showId, 'showId')}/cast/${stamp}.${ext}`
      break
    case 'site-image':
      path = `settings/${slot}-${stamp}.${ext}`
      break
    case 'social-icon':
      path = `settings/social-icons/${stamp}.${ext}`
      break
    case 'avatar':
      path = `${cleanId(input.userId, 'userId')}/avatar-${stamp}.${ext}`
      break
    case 'hero-video':
      path = `hero/${slot === 'mobile' ? 'video-mobile' : 'video'}-${stamp}.${ext}`
      break
    case 'preloader-video':
      path = `preloader/video-${stamp}.${ext}`
      break
    case 'show-video':
      path = `shows/${cleanId(input.showId, 'showId')}/hero-${slot}-${stamp}.${ext}`
      break
  }
  const key = `${def.bucket}/${path}`
  if (!KEY_CHARS_RE.test(key) || key.includes('..') || key.includes('//')) throw new Error('Invalid key')
  return key
}

const STAMP = String.raw`[0-9]{10,16}-[0-9a-f]{8}`
const EXT = String.raw`(?:webp|png|jpg|ico|avif|mp4)`

export type KeyOwner = { slot?: string | null; showId?: string | null; userId?: string | null }

/**
 * True when `key` is exactly the shape mintUploadKey produces for this kind and
 * owner. Finalize uses this to refuse a key from another kind, another show or
 * another user's avatar folder. For avatars the caller's id is mandatory.
 */
export function keyMatchesKind(kind: UploadKind, key: string, owner: KeyOwner): boolean {
  if (!isUploadKind(kind) || typeof key !== 'string') return false
  if (!KEY_CHARS_RE.test(key) || key.includes('..') || key.includes('//')) return false
  const def = UPLOAD_KINDS[kind]
  const bucket = def.bucket
  const slot = owner.slot ? owner.slot : undefined
  if (def.slots.length > 0 && slot !== undefined && !def.slots.includes(slot)) return false
  const slotAlt = slot ?? def.slots.join('|')
  const showAlt = owner.showId ? owner.showId.toLowerCase() : '[0-9a-f-]{36}'
  if (owner.showId && !UUID_RE.test(showAlt)) return false

  let re: RegExp
  switch (kind) {
    case 'artwork':
      re = new RegExp(`^${bucket}/shows/(${showAlt})/(${slotAlt})-${STAMP}\\.${EXT}$`)
      break
    case 'cast-image':
      re = new RegExp(`^${bucket}/shows/(${showAlt})/cast/${STAMP}\\.${EXT}$`)
      break
    case 'site-image':
      re = new RegExp(`^${bucket}/settings/(${slotAlt})-${STAMP}\\.${EXT}$`)
      break
    case 'social-icon':
      re = new RegExp(`^${bucket}/settings/social-icons/${STAMP}\\.${EXT}$`)
      break
    case 'avatar': {
      const uid = owner.userId ? owner.userId.toLowerCase() : ''
      if (!UUID_RE.test(uid)) return false
      re = new RegExp(`^${bucket}/${uid}/avatar-${STAMP}\\.${EXT}$`)
      break
    }
    case 'hero-video': {
      const name = slot === 'mobile' ? 'video-mobile' : slot === 'desktop' ? 'video' : 'video(?:-mobile)?'
      re = new RegExp(`^${bucket}/hero/${name}-${STAMP}\\.mp4$`)
      break
    }
    case 'preloader-video':
      re = new RegExp(`^${bucket}/preloader/video-${STAMP}\\.mp4$`)
      break
    case 'show-video':
      re = new RegExp(`^${bucket}/shows/(${showAlt})/hero-(${slotAlt})-${STAMP}\\.mp4$`)
      break
  }
  return re.test(key)
}

/** True only for `_v/<640|1280|1920>/webp/<key>` where <key> is exactly `key`. */
export function isVariantKeyFor(variantKey: string, key: string): boolean {
  if (typeof variantKey !== 'string' || typeof key !== 'string') return false
  for (const w of VARIANT_WIDTHS) {
    if (variantKey === `_v/${w}/webp/${key}`) return true
  }
  return false
}

export function variantKeyFor(key: string, width: VariantWidth): string {
  return `_v/${width}/webp/${key}`
}

export type VariantUpload = { width: VariantWidth; size: number }
export type VariantPlan = { ok: true; variants: VariantUpload[] } | { ok: false; error: string }

/**
 * The WebP copies a request may get URLs for, each with the size the browser
 * declared (signed as its Content-Length). Kinds without copies and ICO get
 * none (requested widths are ignored, as before). A duplicate width, a size that
 * is not a positive integer or over the original's cap refuses the request.
 */
export function planVariantUploads(input: {
  kind: UploadKind
  contentType: string
  capBytes: number
  variants?: ReadonlyArray<{ width: number; size: number }>
}): VariantPlan {
  const def = UPLOAD_KINDS[input.kind]
  if (!def?.variants || normalizeContentType(input.contentType) === 'image/x-icon') return { ok: true, variants: [] }
  const requested = input.variants ?? []
  const out: VariantUpload[] = []
  for (const width of VARIANT_WIDTHS) {
    const matches = requested.filter((v) => v.width === width)
    if (matches.length === 0) continue
    if (matches.length > 1) return { ok: false, error: 'Invalid upload request' }
    const size = matches[0].size
    if (typeof size !== 'number' || !Number.isSafeInteger(size) || size <= 0 || size > input.capBytes) {
      return { ok: false, error: 'Invalid upload request' }
    }
    out.push({ width, size })
  }
  return { ok: true, variants: out }
}
