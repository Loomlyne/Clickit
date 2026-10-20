import { test } from 'node:test'
import assert from 'node:assert/strict'
import { CRON_ROUTES, cronPathFor } from '../../src/server/cron-schedule.ts'

test('cronPathFor maps the daily publish cron', () => {
  assert.equal(cronPathFor('0 1 * * *'), '/api/cron/publish-scheduled')
})

test('cronPathFor maps the weekly cleanup cron', () => {
  assert.equal(cronPathFor('0 4 * * 1'), '/api/cron/cleanup-media')
})

test('cronPathFor returns null for any other string', () => {
  assert.equal(cronPathFor('* * * * *'), null)
  assert.equal(cronPathFor(''), null)
  assert.equal(cronPathFor('0 1 * * * '), null)
})

test('cronPathFor does not resolve inherited object keys', () => {
  assert.equal(cronPathFor('constructor'), null)
  assert.equal(cronPathFor('__proto__'), null)
  assert.equal(cronPathFor('toString'), null)
})

test('CRON_ROUTES is frozen and has exactly the two vercel.json crons', () => {
  assert.equal(Object.isFrozen(CRON_ROUTES), true)
  assert.deepEqual(Object.keys(CRON_ROUTES).sort(), ['0 1 * * *', '0 4 * * 1'])
})
