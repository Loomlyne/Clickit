import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  getPublicMediaOrigin,
  isPublicR2MediaUrl,
  toPublicR2MediaUrl,
} from '../../src/lib/supabase-media.ts'

const SUPABASE_HOST = 'abc.supabase.co'
const SUPABASE_URL = `https://${SUPABASE_HOST}/storage/v1/object/public/show-artwork/a.jpg?v=1`

test('https origin needs the verified flag', () => {
  assert.equal(
    getPublicMediaOrigin('https://m.example', 'verified'),
    'https://m.example'
  )
  assert.equal(getPublicMediaOrigin('https://m.example', undefined), null)
  assert.equal(getPublicMediaOrigin('https://m.example', 'yes'), null)
})

test('the verified flag is still required when loopback is allowed', () => {
  assert.equal(getPublicMediaOrigin('https://m.example', undefined, '1'), null)
})

test('loopback: http://127.0.0.1 is accepted only with ALLOW_LOOPBACK=1', () => {
  assert.equal(
    getPublicMediaOrigin('http://127.0.0.1:8789', undefined, '1'),
    'http://127.0.0.1:8789'
  )
  assert.equal(getPublicMediaOrigin('http://127.0.0.1:8789', undefined), null)
  assert.equal(
    getPublicMediaOrigin('http://127.0.0.1:8789', undefined, '0'),
    null
  )
  assert.equal(
    getPublicMediaOrigin('http://127.0.0.1:8789', 'verified'),
    null
  )
})

test('loopback accepts only the literal 127.0.0.1 host', () => {
  for (const origin of [
    'http://localhost:8789',
    'http://[::1]:8789',
    'http://0.0.0.0:8789',
    'http://192.168.1.5:8789',
    'http://m.example',
  ]) {
    assert.equal(getPublicMediaOrigin(origin, undefined, '1'), null, origin)
  }
})

test('loopback origin rejects paths, credentials, query and hash', () => {
  for (const origin of [
    'http://127.0.0.1:8789/path',
    'http://u:p@127.0.0.1:8789',
    'http://127.0.0.1:8789/?a=1',
    'http://127.0.0.1:8789/#x',
  ]) {
    assert.equal(getPublicMediaOrigin(origin, undefined, '1'), null, origin)
  }
})

test('toPublicR2MediaUrl maps Supabase URLs on a verified https origin', () => {
  assert.equal(
    toPublicR2MediaUrl(SUPABASE_URL, SUPABASE_HOST, 'https://m.example', 'verified'),
    'https://m.example/show-artwork/a.jpg?v=1'
  )
})

test('toPublicR2MediaUrl never maps in loopback mode', () => {
  assert.equal(
    toPublicR2MediaUrl(
      SUPABASE_URL,
      SUPABASE_HOST,
      'http://127.0.0.1:8789',
      undefined,
      '1'
    ),
    null
  )
  assert.equal(
    toPublicR2MediaUrl(
      SUPABASE_URL,
      SUPABASE_HOST,
      'http://127.0.0.1:8789',
      'verified',
      '1'
    ),
    null
  )
})

test('toPublicR2MediaUrl returns null with the flag unset (today behaviour)', () => {
  assert.equal(
    toPublicR2MediaUrl(SUPABASE_URL, SUPABASE_HOST, 'https://m.example', undefined),
    null
  )
})

test('isPublicR2MediaUrl recognises loopback media URLs only in loopback mode', () => {
  const url = 'http://127.0.0.1:8789/show-artwork/a.jpg'
  assert.equal(
    isPublicR2MediaUrl(url, 'http://127.0.0.1:8789', undefined, '1'),
    true
  )
  assert.equal(
    isPublicR2MediaUrl(url, 'http://127.0.0.1:8789', undefined),
    false
  )
})
