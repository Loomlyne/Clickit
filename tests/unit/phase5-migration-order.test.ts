// Phase 5 migrations must sort after every migration that is not another later phase's own:
// apply-live-migrations.yml runs `supabase db push` without --include-all, which refuses a
// pending file older than the newest one already applied on live. Re-checked after every main merge.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync } from 'node:fs'

const names = readdirSync('supabase/migrations').filter((n) => n.endsWith('.sql')).sort()
const phase5 = names.filter((n) => /_phase5_/.test(n))
const base = names.filter((n) => !/_phase\d+_/.test(n))

test('Phase 5 migrations sort after every non-phase migration', () => {
  assert.ok(phase5.length >= 2, `expected M1a and M1b, found ${phase5.join(', ') || 'none'}`)
  const newestBase = base.at(-1)!
  for (const f of phase5) assert.ok(f > newestBase, `${f} sorts before ${newestBase}`)
})

test('M1a sorts before M1b', () => {
  const m1a = phase5.find((n) => n.endsWith('_phase5_m1a_accounts.sql'))
  const m1b = phase5.find((n) => n.endsWith('_phase5_m1b_email_outbox.sql'))
  assert.ok(m1a && m1b && m1a < m1b)
})
