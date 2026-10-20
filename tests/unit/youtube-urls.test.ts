// Strict YouTube link parsing (T-06-12): host allow-list, http/https only,
// length cap, ids matched against a strict regex.
import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  PLAYLIST_ID_RE,
  VIDEO_ID_RE,
  parsePlaylistId,
  parseVideoIdStrict,
} from '../../src/server/youtube/urls.ts'
import {
  YOUTUBE_ERROR_CODES,
  YOUTUBE_ERROR_MESSAGE_KEYS,
} from '../../src/lib/youtube-errors.ts'

const VID = 'dQw4w9WgXcQ'

test('parsePlaylistId reads list= from a playlist link', () => {
  assert.deepEqual(
    parsePlaylistId('https://www.youtube.com/playlist?list=PLabc123_-x'),
    { ok: true, id: 'PLabc123_-x' }
  )
})

test('parsePlaylistId accepts watch?v=...&list=...', () => {
  assert.deepEqual(
    parsePlaylistId(`https://youtube.com/watch?v=${VID}&list=PLx1`),
    { ok: true, id: 'PLx1' }
  )
})

test('parsePlaylistId tolerates surrounding whitespace and m./music. hosts', () => {
  assert.deepEqual(
    parsePlaylistId('  https://m.youtube.com/playlist?list=PLx1  '),
    { ok: true, id: 'PLx1' }
  )
  assert.deepEqual(
    parsePlaylistId('https://music.youtube.com/playlist?list=PLx1'),
    { ok: true, id: 'PLx1' }
  )
})

test('parsePlaylistId refuses a single video link with a distinct code', () => {
  assert.deepEqual(parsePlaylistId(`https://youtu.be/${VID}`), {
    ok: false,
    code: 'video_link_in_import',
  })
  assert.deepEqual(parsePlaylistId(`https://www.youtube.com/watch?v=${VID}`), {
    ok: false,
    code: 'video_link_in_import',
  })
})

test('parsePlaylistId refuses non-YouTube hosts, bad schemes and junk', () => {
  for (const bad of [
    'https://vimeo.com/x?list=PL1',
    'javascript:alert(1)',
    'ftp://www.youtube.com/playlist?list=PL1',
    'https://evil.com/youtube.com/playlist?list=PL1',
    'https://www.youtube.com.evil.com/playlist?list=PL1',
    'not a url',
    '',
  ]) {
    assert.deepEqual(
      parsePlaylistId(bad),
      { ok: false, code: 'not_a_playlist_link' },
      bad
    )
  }
})

test('parsePlaylistId refuses a playlist id with bad characters', () => {
  assert.deepEqual(
    parsePlaylistId('https://www.youtube.com/playlist?list=PL%3Cscript%3E'),
    { ok: false, code: 'not_a_playlist_link' }
  )
  assert.deepEqual(parsePlaylistId('https://www.youtube.com/playlist?list='), {
    ok: false,
    code: 'not_a_playlist_link',
  })
})

test('parseVideoIdStrict accepts a bare id and every link shape', () => {
  for (const ok of [
    VID,
    ` ${VID} `,
    `https://youtu.be/${VID}`,
    `https://www.youtube.com/watch?v=${VID}&t=10`,
    `https://www.youtube.com/watch?t=10&v=${VID}`,
    `https://www.youtube.com/embed/${VID}`,
    `https://www.youtube.com/shorts/${VID}`,
    `https://www.youtube.com/live/${VID}`,
    `https://m.youtube.com/watch?v=${VID}`,
  ]) {
    assert.deepEqual(parseVideoIdStrict(ok), { ok: true, id: VID }, ok)
  }
})

test('parseVideoIdStrict sends a playlist link to the import path', () => {
  assert.deepEqual(
    parseVideoIdStrict('https://www.youtube.com/playlist?list=PL1'),
    { ok: false, code: 'playlist_link_in_form' }
  )
})

test('parseVideoIdStrict refuses wrong length, markup and foreign hosts', () => {
  for (const bad of [
    'dQw4w9WgXc',
    'dQw4w9WgXcQQ',
    '<script>',
    `https://evil.com/watch?v=${VID}`,
    `https://www.youtube.com.evil.com/watch?v=${VID}`,
    `javascript:alert(1)//youtu.be/${VID}`,
    'https://www.youtube.com/watch?v=short',
    'https://www.youtube.com/',
    '',
  ]) {
    assert.deepEqual(
      parseVideoIdStrict(bad),
      { ok: false, code: 'not_a_video_link' },
      bad
    )
  }
})

test('input longer than 2048 characters is refused without parsing', () => {
  const long = `https://www.youtube.com/playlist?list=PL1&x=${'a'.repeat(2100)}`
  assert.deepEqual(parsePlaylistId(long), {
    ok: false,
    code: 'not_a_playlist_link',
  })
  assert.deepEqual(parseVideoIdStrict(long), {
    ok: false,
    code: 'not_a_video_link',
  })
})

test('id patterns are anchored', () => {
  assert.equal(VIDEO_ID_RE.test(VID), true)
  assert.equal(VIDEO_ID_RE.test(`${VID}x`), false)
  assert.equal(PLAYLIST_ID_RE.test('PLabc_-1'), true)
  assert.equal(PLAYLIST_ID_RE.test('PL abc'), false)
  assert.equal(PLAYLIST_ID_RE.test('a'), false)
})

test('every error code has a message key, in the same order as the list', () => {
  assert.deepEqual(
    Object.keys(YOUTUBE_ERROR_MESSAGE_KEYS),
    [...YOUTUBE_ERROR_CODES]
  )
  for (const code of YOUTUBE_ERROR_CODES) {
    assert.match(YOUTUBE_ERROR_MESSAGE_KEYS[code], /^[a-z][A-Za-z]+$/, code)
  }
  assert.equal(YOUTUBE_ERROR_MESSAGE_KEYS.video_not_found, 'videoNotFound')
  assert.equal(YOUTUBE_ERROR_MESSAGE_KEYS.api_not_allowed, 'keyRejected')
  assert.equal(YOUTUBE_ERROR_MESSAGE_KEYS.not_a_playlist_link, 'notAPlaylistLink')
})
