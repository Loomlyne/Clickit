import { test } from 'node:test'
import assert from 'node:assert/strict'
import { requireArchived, canDeletePermanently } from '../../src/lib/admin/guards.ts'

test('requireArchived: missing show', () => {
  assert.deepEqual(requireArchived(null, 'show'), { ok: false, error: 'Show not found.' })
})
test('requireArchived: missing episode (undefined)', () => {
  assert.deepEqual(requireArchived(undefined, 'episode'), { ok: false, error: 'Episode not found.' })
})
test('requireArchived: non-archived show', () => {
  assert.deepEqual(requireArchived({ archived: false }, 'show'), {
    ok: false,
    error: 'Archive this show before deleting it permanently.',
  })
})
test('requireArchived: non-archived episode', () => {
  assert.deepEqual(requireArchived({ archived: false }, 'episode'), {
    ok: false,
    error: 'Archive this episode before deleting it permanently.',
  })
})
test('requireArchived: null archived flag refused', () => {
  assert.equal(requireArchived({ archived: null }, 'show').ok, false)
})
test('requireArchived: archived ok', () => {
  assert.deepEqual(requireArchived({ archived: true }, 'show'), { ok: true })
})
test('canDeletePermanently: archived true', () => {
  assert.equal(canDeletePermanently({ archived: true }), true)
})
test('canDeletePermanently: archived false', () => {
  assert.equal(canDeletePermanently({ archived: false }), false)
})
test('canDeletePermanently: archived null', () => {
  assert.equal(canDeletePermanently({ archived: null }), false)
})
test('canDeletePermanently: empty object', () => {
  assert.equal(canDeletePermanently({}), false)
})
