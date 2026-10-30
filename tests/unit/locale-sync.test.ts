import assert from 'node:assert/strict'
import { test } from 'node:test'

import { LOCALE_SYNC_KEY, shouldSyncLocale } from '../../src/lib/locale-sync-core.ts'

test('nothing synced yet: sync', () => {
  assert.equal(shouldSyncLocale('en', null), true)
})

test('same language as the last sync (reload): no call', () => {
  assert.equal(shouldSyncLocale('en', 'en'), false)
  assert.equal(shouldSyncLocale('ar', 'ar'), false)
})

test('en -> ar -> en syncs on every switch', () => {
  let last: string | null = null
  let calls = 0
  for (const current of ['en', 'ar', 'en']) {
    if (shouldSyncLocale(current, last)) {
      calls += 1
      last = current
    }
  }
  assert.equal(calls, 3)
  assert.equal(shouldSyncLocale('ar', 'en'), true)
})

test('one sessionStorage key', () => {
  assert.equal(LOCALE_SYNC_KEY, 'clickit:locale-last-synced')
})
