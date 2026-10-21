import assert from 'node:assert/strict'
import test from 'node:test'
import {
  UPLOAD_KINDS,
  checkUploadRequest,
  mintUploadKey,
  keyMatchesKind,
  isVariantKeyFor,
  VARIANT_WIDTHS,
  planVariantUploads,
} from '../../src/server/upload-kinds.ts'
import { HERO_VIDEO_MAX_BYTES, SVG_REJECTED_MESSAGE } from '../../src/lib/admin/media-guards.ts'

const MB = 1024 * 1024
const SHOW = '0b8f3c1e-5d2a-4c7b-9e1f-3a6d8c2b4f10'
const USER = '7c1d2e3f-4a5b-4c6d-8e7f-9a0b1c2d3e4f'
const OTHER = '11111111-2222-4333-8444-555555555555'
const fixed = { now: 1760000000000, random: () => 'abcdef12' }

test('every expected kind exists with a bucket', () => {
  const kinds = Object.keys(UPLOAD_KINDS).sort()
  assert.deepEqual(kinds, [
    'artwork',
    'avatar',
    'cast-image',
    'hero-video',
    'preloader-video',
    'show-video',
    'site-image',
    'social-icon',
  ])
  assert.equal(UPLOAD_KINDS.artwork.bucket, 'show-artwork')
  assert.equal(UPLOAD_KINDS['site-image'].bucket, 'site-assets')
  assert.equal(UPLOAD_KINDS.avatar.bucket, 'avatars')
})

test('caps equal the existing ones', () => {
  const cap = (kind: string, slot?: string, contentType = 'image/png') => {
    const over = checkUploadRequest({ kind, slot, contentType, size: 100 * MB } as never)
    return over
  }
  // exactly at the cap passes, one byte over fails
  const at = (kind: string, slot: string | undefined, contentType: string, bytes: number) => ({
    ok: checkUploadRequest({ kind, slot, contentType, size: bytes } as never).ok,
    over: checkUploadRequest({ kind, slot, contentType, size: bytes + 1 } as never).ok,
  })
  for (const slot of ['poster', 'card', 'hero', 'hero-mobile']) {
    assert.deepEqual(at('artwork', slot, 'image/png', 10 * MB), { ok: true, over: false }, slot)
  }
  assert.deepEqual(at('artwork', 'logo', 'image/png', 2 * MB), { ok: true, over: false })
  for (const slot of ['og', 'favicon', 'favicon-dark', 'auth']) {
    assert.deepEqual(at('site-image', slot, 'image/png', 5 * MB), { ok: true, over: false }, slot)
  }
  assert.deepEqual(at('social-icon', undefined, 'image/png', 2 * MB), { ok: true, over: false })
  assert.deepEqual(at('cast-image', undefined, 'image/png', 2 * MB), { ok: true, over: false })
  assert.deepEqual(at('avatar', undefined, 'image/png', 2 * MB), { ok: true, over: false })
  assert.deepEqual(at('hero-video', 'desktop', 'video/mp4', 50 * MB), { ok: true, over: false })
  assert.deepEqual(at('show-video', 'mobile', 'video/mp4', 50 * MB), { ok: true, over: false })
  assert.deepEqual(at('preloader-video', undefined, 'video/mp4', 20 * MB), { ok: true, over: false })
  void cap
})

test('hero video over 50 MB is refused with the existing message', () => {
  const r = checkUploadRequest({
    kind: 'hero-video',
    slot: 'desktop',
    contentType: 'video/mp4',
    size: HERO_VIDEO_MAX_BYTES + 1,
  })
  assert.deepEqual(r, { ok: false, error: 'Video must be under 50MB' })
})

test('artwork logo at 3 MB is refused', () => {
  const r = checkUploadRequest({ kind: 'artwork', slot: 'logo', contentType: 'image/png', size: 3 * MB })
  assert.equal(r.ok, false)
})

test('SVG is refused with the 01.1 message on every image kind', () => {
  const cases: Array<[string, string | undefined]> = [
    ['site-image', 'favicon'],
    ['site-image', 'og'],
    ['artwork', 'poster'],
    ['social-icon', undefined],
    ['cast-image', undefined],
    ['avatar', undefined],
  ]
  for (const [kind, slot] of cases) {
    const r = checkUploadRequest({ kind, slot, contentType: 'image/svg+xml', size: 1000 } as never)
    assert.deepEqual(r, { ok: false, error: SVG_REJECTED_MESSAGE }, kind)
  }
  // case and parameters do not slip past
  const r = checkUploadRequest({
    kind: 'site-image',
    slot: 'og',
    contentType: 'IMAGE/SVG+XML; charset=utf-8',
    size: 1000,
  })
  assert.deepEqual(r, { ok: false, error: SVG_REJECTED_MESSAGE })
})

test('favicon accepts image/x-icon, og accepts image/jpeg, og refuses ICO', () => {
  const ico = checkUploadRequest({ kind: 'site-image', slot: 'favicon', contentType: 'image/x-icon', size: 1000 })
  assert.equal(ico.ok, true)
  if (ico.ok) assert.equal(ico.ext, 'ico')
  const alias = checkUploadRequest({
    kind: 'site-image',
    slot: 'favicon',
    contentType: 'image/vnd.microsoft.icon',
    size: 1000,
  })
  assert.equal(alias.ok && alias.contentType, 'image/x-icon')
  assert.equal(
    checkUploadRequest({ kind: 'site-image', slot: 'og', contentType: 'image/jpeg', size: 1000 }).ok,
    true
  )
  assert.equal(
    checkUploadRequest({ kind: 'site-image', slot: 'og', contentType: 'image/x-icon', size: 1000 }).ok,
    false
  )
})

test('types outside the allowlist are refused', () => {
  for (const [kind, slot, type] of [
    ['artwork', 'poster', 'image/avif'],
    ['artwork', 'poster', 'image/gif'],
    ['artwork', 'poster', 'text/html'],
    ['cast-image', undefined, 'image/avif'],
    ['avatar', undefined, 'application/pdf'],
    ['hero-video', 'desktop', 'video/webm'],
    ['hero-video', 'desktop', 'image/png'],
    ['show-video', 'desktop', 'text/html'],
  ] as const) {
    assert.equal(
      checkUploadRequest({ kind, slot, contentType: type, size: 1000 } as never).ok,
      false,
      `${kind} ${type}`
    )
  }
})

test('unknown kind, unknown slot, missing slot, zero or bad size are refused', () => {
  assert.equal(checkUploadRequest({ kind: 'nope', contentType: 'image/png', size: 10 } as never).ok, false)
  assert.equal(
    checkUploadRequest({ kind: 'artwork', slot: 'bogus', contentType: 'image/png', size: 10 }).ok,
    false
  )
  assert.equal(checkUploadRequest({ kind: 'artwork', contentType: 'image/png', size: 10 }).ok, false)
  for (const size of [0, -1, NaN, Infinity, 1.5, '10' as never]) {
    assert.equal(
      checkUploadRequest({ kind: 'avatar', contentType: 'image/png', size }).ok,
      false,
      String(size)
    )
  }
})

test('an ok result carries the normalized content type, extension and cap', () => {
  const r = checkUploadRequest({ kind: 'avatar', contentType: 'image/jpg', size: 100 })
  assert.deepEqual(r, { ok: true, contentType: 'image/jpeg', ext: 'jpg', capBytes: 2 * MB })
})

test('mintUploadKey: avatar keys sit under avatars/<userId>/', () => {
  const key = mintUploadKey('avatar', { userId: USER, contentType: 'image/webp', ...fixed })
  assert.ok(key.startsWith(`avatars/${USER}/`), key)
  assert.match(key, /\.webp$/)
})

test('mintUploadKey layouts per kind', () => {
  const mint = (kind: string, input: Record<string, unknown>) =>
    mintUploadKey(kind as never, { ...input, ...fixed } as never)
  assert.equal(
    mint('artwork', { slot: 'poster', showId: SHOW, contentType: 'image/png' }),
    `show-artwork/shows/${SHOW}/poster-1760000000000-abcdef12.png`
  )
  assert.equal(
    mint('cast-image', { showId: SHOW, contentType: 'image/jpeg' }),
    `show-artwork/shows/${SHOW}/cast/1760000000000-abcdef12.jpg`
  )
  assert.equal(
    mint('site-image', { slot: 'favicon', contentType: 'image/x-icon' }),
    'site-assets/settings/favicon-1760000000000-abcdef12.ico'
  )
  assert.equal(
    mint('social-icon', { contentType: 'image/png' }),
    'site-assets/settings/social-icons/1760000000000-abcdef12.png'
  )
  assert.equal(
    mint('hero-video', { slot: 'mobile', contentType: 'video/mp4' }),
    'site-assets/hero/video-mobile-1760000000000-abcdef12.mp4'
  )
  assert.equal(
    mint('hero-video', { slot: 'desktop', contentType: 'video/mp4' }),
    'site-assets/hero/video-1760000000000-abcdef12.mp4'
  )
  assert.equal(
    mint('preloader-video', { contentType: 'video/mp4' }),
    'site-assets/preloader/video-1760000000000-abcdef12.mp4'
  )
  assert.equal(
    mint('show-video', { slot: 'desktop', showId: SHOW, contentType: 'video/mp4' }),
    `site-assets/shows/${SHOW}/hero-desktop-1760000000000-abcdef12.mp4`
  )
})

test('minted keys only contain [a-z0-9/_.-] even with hostile input', () => {
  const hostile = [
    mintUploadKey('avatar', { userId: USER.toUpperCase(), contentType: 'image/png', ...fixed }),
    mintUploadKey('artwork', {
      slot: 'poster',
      showId: SHOW,
      contentType: 'image/png',
      filename: '../../etc/passwd\u0000<script>.png',
      ...fixed,
    } as never),
  ]
  for (const key of hostile) assert.match(key, /^[a-z0-9/_.-]+$/, key)
  assert.ok(!hostile[1]!.includes('..'))
})

test('mintUploadKey throws on a missing or malformed id, never mints', () => {
  assert.throws(() => mintUploadKey('avatar', { userId: '../x', contentType: 'image/png', ...fixed }))
  assert.throws(() => mintUploadKey('avatar', { userId: 'a/b', contentType: 'image/png', ...fixed }))
  assert.throws(() => mintUploadKey('artwork', { slot: 'poster', contentType: 'image/png', ...fixed } as never))
  assert.throws(() =>
    mintUploadKey('artwork', { slot: 'poster', showId: 'x/../y', contentType: 'image/png', ...fixed })
  )
  assert.throws(() => mintUploadKey('artwork', { slot: 'poster', showId: SHOW, contentType: 'image/gif', ...fixed }))
})

test('keyMatchesKind accepts minted keys and refuses other prefixes and owners', () => {
  const art = mintUploadKey('artwork', { slot: 'poster', showId: SHOW, contentType: 'image/png', ...fixed })
  assert.equal(keyMatchesKind('artwork', art, { slot: 'poster' }), true)
  assert.equal(keyMatchesKind('artwork', art, { slot: 'poster', showId: SHOW }), true)
  assert.equal(keyMatchesKind('artwork', art, { slot: 'poster', showId: OTHER }), false)
  assert.equal(keyMatchesKind('artwork', art, { slot: 'card' }), false)
  assert.equal(keyMatchesKind('site-image', art, { slot: 'og' }), false)
  assert.equal(keyMatchesKind('cast-image', art, {}), false)

  const av = mintUploadKey('avatar', { userId: USER, contentType: 'image/png', ...fixed })
  assert.equal(keyMatchesKind('avatar', av, { userId: USER }), true)
  assert.equal(keyMatchesKind('avatar', av, { userId: OTHER }), false)
  assert.equal(keyMatchesKind('avatar', av, {}), false)
  assert.equal(keyMatchesKind('avatar', `avatars/${USER}/../${OTHER}/x.png`, { userId: USER }), false)
  assert.equal(keyMatchesKind('avatar', `${av}/extra`, { userId: USER }), false)
  assert.equal(keyMatchesKind('avatar', `_v/640/webp/${av}`, { userId: USER }), false)
})

test('isVariantKeyFor: only _v/<640|1280|1920>/webp/<same key>', () => {
  const key = `avatars/${USER}/avatar-1-abcdef12.png`
  assert.deepEqual(VARIANT_WIDTHS, [640, 1280, 1920])
  for (const w of VARIANT_WIDTHS) assert.equal(isVariantKeyFor(`_v/${w}/webp/${key}`, key), true)
  assert.equal(isVariantKeyFor(`_v/800/webp/${key}`, key), false)
  assert.equal(isVariantKeyFor(`_v/640/avif/${key}`, key), false)
  assert.equal(isVariantKeyFor(`_v/640/webp/other/${key}`, key), false)
  assert.equal(isVariantKeyFor(`_v/640/webp/${key}x`, key), false)
  assert.equal(isVariantKeyFor(`x/_v/640/webp/${key}`, key), false)
  assert.equal(isVariantKeyFor(key, key), false)
})

test('variants are allowed for rasters except ICO, never for videos', () => {
  assert.equal(UPLOAD_KINDS.artwork.variants, true)
  assert.equal(UPLOAD_KINDS['site-image'].variants, true)
  assert.equal(UPLOAD_KINDS['hero-video'].variants, false)
  assert.equal(UPLOAD_KINDS['preloader-video'].variants, false)
  assert.equal(UPLOAD_KINDS['show-video'].variants, false)
})

test('admin kinds require admin, avatar requires a signed-in user', () => {
  for (const k of Object.keys(UPLOAD_KINDS) as Array<keyof typeof UPLOAD_KINDS>) {
    assert.equal(UPLOAD_KINDS[k].actor, k === 'avatar' ? 'user' : 'admin', k)
  }
})

// ------------------------------------------- declared variant sizes (review item 2)

test('planVariantUploads keeps declared widths in VARIANT_WIDTHS order with their sizes', () => {
  const res = planVariantUploads({
    kind: 'artwork',
    contentType: 'image/png',
    capBytes: 10 * MB,
    variants: [
      { width: 1920, size: 300 },
      { width: 640, size: 100 },
    ],
  })
  assert.deepEqual(res, { ok: true, variants: [{ width: 640, size: 100 }, { width: 1920, size: 300 }] })
})

test('planVariantUploads gives no variants for ICO, videos or none requested', () => {
  const v = [{ width: 640 as const, size: 10 }]
  assert.deepEqual(planVariantUploads({ kind: 'site-image', contentType: 'image/x-icon', capBytes: MB, variants: v }), {
    ok: true,
    variants: [],
  })
  assert.deepEqual(planVariantUploads({ kind: 'hero-video', contentType: 'video/mp4', capBytes: MB, variants: v }), {
    ok: true,
    variants: [],
  })
  assert.deepEqual(planVariantUploads({ kind: 'artwork', contentType: 'image/png', capBytes: MB }), {
    ok: true,
    variants: [],
  })
})

test('planVariantUploads refuses a duplicate width, a size over the cap and a bad size', () => {
  const base = { kind: 'artwork' as const, contentType: 'image/png', capBytes: 1000 }
  assert.equal(
    planVariantUploads({ ...base, variants: [{ width: 640, size: 1 }, { width: 640, size: 2 }] }).ok,
    false
  )
  assert.equal(planVariantUploads({ ...base, variants: [{ width: 640, size: 1001 }] }).ok, false)
  for (const size of [0, -1, 1.5, Number.NaN]) {
    assert.equal(planVariantUploads({ ...base, variants: [{ width: 640, size }] }).ok, false, String(size))
  }
})
