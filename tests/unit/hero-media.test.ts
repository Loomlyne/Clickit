/**
 * Unit tests for the hero media resolution fallback chain.
 *
 * Runs with the Node.js built-in test runner. No Vitest or Jest needed.
 *
 * Test coverage: the 5 branches of resolveHeroMedia, mobile video, mobile
 * uses desktop video fallback, mobile image, mobile uses desktop image
 * fallback, and the null (bloom-only) case. Plus the 3 desktop branches.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { resolveHeroMedia } from '../../src/lib/hero-media.ts'

const DESKTOP_VIDEO = 'https://cdn/hero-desktop.mp4'
const MOBILE_VIDEO = 'https://cdn/hero-mobile.mp4'
const DESKTOP_IMAGE = 'https://cdn/hero-desktop.webp'
const MOBILE_IMAGE = 'https://cdn/hero-mobile.webp'
const YT_URL = 'https://www.youtube.com/watch?v=abc123'

// Desktop viewport

test('desktop: prefers desktop video when both video and image exist', () => {
  const result = resolveHeroMedia(false, {
    videoUrl: DESKTOP_VIDEO,
    videoType: 'mp4',
    imageUrl: DESKTOP_IMAGE,
  })
  assert.deepEqual(result, { kind: 'video', url: DESKTOP_VIDEO, type: 'mp4' })
})

test('desktop: falls back to image when no video', () => {
  const result = resolveHeroMedia(false, {
    imageUrl: DESKTOP_IMAGE,
  })
  assert.deepEqual(result, { kind: 'image', url: DESKTOP_IMAGE })
})

test('desktop: returns null when nothing provided', () => {
  const result = resolveHeroMedia(false, {})
  assert.equal(result, null)
})

test('desktop: ignores mobile-only media', () => {
  const result = resolveHeroMedia(false, {
    mobileVideoUrl: MOBILE_VIDEO,
    mobileVideoType: 'mp4',
    mobileImageUrl: MOBILE_IMAGE,
  })
  assert.equal(result, null)
})

test('desktop: video with type=youtube uses youtube', () => {
  const result = resolveHeroMedia(false, {
    videoUrl: YT_URL,
    videoType: 'youtube',
  })
  assert.deepEqual(result, { kind: 'video', url: YT_URL, type: 'youtube' })
})

test('desktop: video without type is ignored (invariant safety)', () => {
  const result = resolveHeroMedia(false, {
    videoUrl: DESKTOP_VIDEO,
    imageUrl: DESKTOP_IMAGE,
  })
  // videoType missing, treat as no video and fall through to image
  assert.deepEqual(result, { kind: 'image', url: DESKTOP_IMAGE })
})

// Mobile viewport, fallback chain

test('mobile: prefers mobile video when all four variants exist', () => {
  const result = resolveHeroMedia(true, {
    videoUrl: DESKTOP_VIDEO,
    videoType: 'mp4',
    mobileVideoUrl: MOBILE_VIDEO,
    mobileVideoType: 'mp4',
    imageUrl: DESKTOP_IMAGE,
    mobileImageUrl: MOBILE_IMAGE,
  })
  assert.deepEqual(result, { kind: 'video', url: MOBILE_VIDEO, type: 'mp4' })
})

test('mobile: prefers mobile image over desktop video when no mobile video', () => {
  const result = resolveHeroMedia(true, {
    videoUrl: DESKTOP_VIDEO,
    videoType: 'mp4',
    mobileImageUrl: MOBILE_IMAGE,
  })
  assert.deepEqual(result, { kind: 'image', url: MOBILE_IMAGE })
})

test('mobile: falls back to mobile image when no videos', () => {
  const result = resolveHeroMedia(true, {
    mobileImageUrl: MOBILE_IMAGE,
    imageUrl: DESKTOP_IMAGE,
  })
  assert.deepEqual(result, { kind: 'image', url: MOBILE_IMAGE })
})

test('mobile: falls back to desktop image when no videos and no mobile image', () => {
  const result = resolveHeroMedia(true, { imageUrl: DESKTOP_IMAGE })
  assert.deepEqual(result, { kind: 'image', url: DESKTOP_IMAGE })
})

test('mobile: returns null when nothing provided (bloom-only case)', () => {
  const result = resolveHeroMedia(true, {})
  assert.equal(result, null)
})

// Cross-field invariant safety (defensive rendering when DB state is bad)

test('mobile: url without type ignored, falls through to next branch', () => {
  const result = resolveHeroMedia(true, {
    mobileVideoUrl: MOBILE_VIDEO, // type missing
    videoUrl: DESKTOP_VIDEO,
    videoType: 'mp4',
  })
  assert.deepEqual(result, { kind: 'video', url: DESKTOP_VIDEO, type: 'mp4' })
})

test('mobile: type without url ignored', () => {
  const result = resolveHeroMedia(true, {
    mobileVideoType: 'mp4', // url missing
    imageUrl: DESKTOP_IMAGE,
  })
  assert.deepEqual(result, { kind: 'image', url: DESKTOP_IMAGE })
})

test('mobile: empty string url treated as missing', () => {
  const result = resolveHeroMedia(true, {
    mobileVideoUrl: '',
    mobileVideoType: 'mp4',
    imageUrl: DESKTOP_IMAGE,
  })
  assert.deepEqual(result, { kind: 'image', url: DESKTOP_IMAGE })
})

test('desktop: disallowed video falls back to the desktop image', () => {
  const result = resolveHeroMedia(
    false,
    {
      videoUrl: DESKTOP_VIDEO,
      videoType: 'mp4',
      imageUrl: DESKTOP_IMAGE,
    },
    { allowVideo: false }
  )
  assert.deepEqual(result, { kind: 'image', url: DESKTOP_IMAGE })
})

test('mobile: disallowed video prefers the mobile image', () => {
  const result = resolveHeroMedia(
    true,
    {
      videoUrl: DESKTOP_VIDEO,
      videoType: 'mp4',
      mobileVideoUrl: MOBILE_VIDEO,
      mobileVideoType: 'mp4',
      imageUrl: DESKTOP_IMAGE,
      mobileImageUrl: MOBILE_IMAGE,
    },
    { allowVideo: false }
  )
  assert.deepEqual(result, { kind: 'image', url: MOBILE_IMAGE })
})

test('mobile: disallowed video falls back from mobile image to desktop image', () => {
  const result = resolveHeroMedia(
    true,
    {
      videoUrl: DESKTOP_VIDEO,
      videoType: 'youtube',
      mobileVideoUrl: MOBILE_VIDEO,
      mobileVideoType: 'mp4',
      imageUrl: DESKTOP_IMAGE,
    },
    { allowVideo: false }
  )
  assert.deepEqual(result, { kind: 'image', url: DESKTOP_IMAGE })
})

test('video-only input returns null when video is disallowed', () => {
  const result = resolveHeroMedia(
    false,
    { videoUrl: YT_URL, videoType: 'youtube' },
    { allowVideo: false }
  )
  assert.equal(result, null)
})

test('youtube selection remains unchanged when video is allowed explicitly', () => {
  const result = resolveHeroMedia(
    false,
    { videoUrl: YT_URL, videoType: 'youtube' },
    { allowVideo: true }
  )
  assert.deepEqual(result, { kind: 'video', url: YT_URL, type: 'youtube' })
})
