import assert from 'node:assert/strict'
import { test } from 'node:test'

import { afterSignInCore, type AfterSignInPorts } from '../../src/server/auth/sign-in-core.ts'

type Profile = {
  display_name: string | null
  onboarded_at: string | null
  password_set_at: string | null
  locale: string | null
}

// A fake world whose claimWelcome mimics the DB claim: the first call per user
// returns an outbox id, every later call returns null.
function world(opts: {
  profile?: Profile | null
  isAdmin?: boolean
  claimThrows?: boolean
  queueThrows?: boolean
  getProfileThrows?: boolean
  ensureThrows?: boolean
} = {}) {
  const calls: string[] = []
  const sent: { body: { outboxId: string } }[][] = []
  const warns: string[] = []
  const errors: string[] = []
  const claimed = new Set<string>()
  let profile: Profile | null = opts.profile === undefined ? null : opts.profile
  const ports: AfterSignInPorts = {
    async ensureProfile(userId) {
      calls.push(`ensureProfile:${userId}`)
      if (opts.ensureThrows) throw new Error('db down')
    },
    async getProfile(userId) {
      calls.push(`getProfile:${userId}`)
      if (opts.getProfileThrows) throw new Error('db down')
      return profile
    },
    async setLocale(userId, locale) {
      calls.push(`setLocale:${userId}:${locale}`)
      if (profile) profile = { ...profile, locale }
    },
    async mirrorMetadata(locale) {
      calls.push(`mirrorMetadata:${locale}`)
    },
    async setPasswordSetAt(userId) {
      calls.push(`setPasswordSetAt:${userId}`)
      if (profile) profile = { ...profile, password_set_at: '2026-10-25T00:00:00Z' }
    },
    async claimWelcome(userId, locale) {
      calls.push(`claimWelcome:${userId}:${locale}`)
      if (opts.claimThrows) throw new Error('rpc failed')
      if (claimed.has(userId)) return null
      claimed.add(userId)
      return `outbox-${userId}`
    },
    queue: {
      async sendBatch(messages) {
        if (opts.queueThrows) throw new Error('queue down')
        sent.push(messages)
      },
    },
    async isAdmin(userId) {
      calls.push(`isAdmin:${userId}`)
      return opts.isAdmin ?? false
    },
    log: {
      warn: (m) => void warns.push(m),
      error: (m) => void errors.push(m),
    },
  }
  return { ports, calls, sent, warns, errors }
}

const onboarded: Profile = {
  display_name: 'Mona',
  onboarded_at: '2026-10-01T00:00:00Z',
  password_set_at: null,
  locale: 'en',
}

const user = (locale?: string) => ({ id: 'u1', user_metadata: locale === undefined ? {} : { locale } })

test('ensures the profile, writes the locale and claims the welcome once', async () => {
  const w = world({ profile: { ...onboarded, locale: null } })
  const dest = await afterSignInCore({ user: user(), locale: 'ar', method: 'otp', next: '/series/x' }, w.ports)
  assert.equal(dest, '/series/x')
  assert.equal(w.calls[0], 'ensureProfile:u1')
  assert.ok(w.calls.includes('setLocale:u1:ar'))
  assert.equal(w.calls.filter((c) => c.startsWith('claimWelcome')).length, 1)
  assert.ok(w.calls.includes('claimWelcome:u1:ar'))
  assert.deepEqual(w.sent, [[{ body: { outboxId: 'outbox-u1' } }]])
})

test('mirrors the metadata only when user_metadata.locale differs', async () => {
  const same = world({ profile: onboarded })
  await afterSignInCore({ user: user('en'), locale: 'en', method: 'otp', next: null }, same.ports)
  assert.ok(!same.calls.some((c) => c.startsWith('mirrorMetadata')))

  const differs = world({ profile: onboarded })
  await afterSignInCore({ user: user('en'), locale: 'ar', method: 'otp', next: null }, differs.ports)
  assert.ok(differs.calls.includes('mirrorMetadata:ar'))

  const missing = world({ profile: onboarded })
  await afterSignInCore({ user: user(), locale: 'en', method: 'otp', next: null }, missing.ports)
  assert.ok(missing.calls.includes('mirrorMetadata:en'))
})

test('setLocale is skipped when the profile already has the locale', async () => {
  const w = world({ profile: onboarded })
  await afterSignInCore({ user: user('en'), locale: 'en', method: 'otp', next: null }, w.ports)
  assert.ok(!w.calls.some((c) => c.startsWith('setLocale')))
})

test('password_set_at is recorded only for password sign-ins that have none', async () => {
  const pw = world({ profile: onboarded })
  await afterSignInCore({ user: user('en'), locale: 'en', method: 'password', next: null }, pw.ports)
  assert.ok(pw.calls.includes('setPasswordSetAt:u1'))

  const already = world({ profile: { ...onboarded, password_set_at: '2026-01-01T00:00:00Z' } })
  await afterSignInCore({ user: user('en'), locale: 'en', method: 'password', next: null }, already.ports)
  assert.ok(!already.calls.some((c) => c.startsWith('setPasswordSetAt')))

  for (const method of ['otp', 'link'] as const) {
    const w = world({ profile: onboarded })
    await afterSignInCore({ user: user('en'), locale: 'en', method, next: null }, w.ports)
    assert.ok(!w.calls.some((c) => c.startsWith('setPasswordSetAt')), method)
  }
})

test('claimWelcome returning null sends nothing', async () => {
  const w = world({ profile: onboarded })
  w.ports.claimWelcome = async () => null
  await afterSignInCore({ user: user('en'), locale: 'en', method: 'otp', next: null }, w.ports)
  assert.deepEqual(w.sent, [])
})

test('two sign-ins in a row for the same user send one welcome in total', async () => {
  const w = world({ profile: onboarded })
  await afterSignInCore({ user: user('en'), locale: 'en', method: 'otp', next: null }, w.ports)
  await afterSignInCore({ user: user('en'), locale: 'en', method: 'link', next: null }, w.ports)
  assert.equal(w.calls.filter((c) => c.startsWith('claimWelcome')).length, 2)
  assert.equal(w.sent.length, 1)
})

test('claimWelcome throwing does not fail sign-in and is logged without PII', async () => {
  const w = world({ profile: onboarded, claimThrows: true })
  const dest = await afterSignInCore({ user: user('en'), locale: 'en', method: 'otp', next: '/my-list' }, w.ports)
  assert.equal(dest, '/my-list')
  assert.deepEqual(w.sent, [])
  assert.equal(w.errors.length, 1)
  assert.match(w.errors[0], /\[auth\/welcome\]/)
  assert.ok(!w.errors[0].includes('u1'))
})

test('a queue failure after the claim does not fail sign-in (the sweep retries)', async () => {
  const w = world({ profile: onboarded, queueThrows: true })
  const dest = await afterSignInCore({ user: user('en'), locale: 'en', method: 'otp', next: null }, w.ports)
  assert.equal(dest, '/browse')
  assert.equal(w.warns.length + w.errors.length, 1)
})

test('a new viewer (no profile row, or no name, or not onboarded) goes to the name step', async () => {
  for (const profile of [
    null,
    { ...onboarded, display_name: null },
    { ...onboarded, onboarded_at: null },
  ]) {
    const w = world({ profile })
    const dest = await afterSignInCore({ user: user('en'), locale: 'en', method: 'otp', next: '/series/x' }, w.ports)
    assert.equal(dest, '/auth/welcome?next=%2Fseries%2Fx')
  }
})

test('an admin with no next lands on /admin; a viewer on /browse', async () => {
  const admin = world({ profile: onboarded, isAdmin: true })
  assert.equal(await afterSignInCore({ user: user('en'), locale: 'en', method: 'password', next: null }, admin.ports), '/admin')
  const viewer = world({ profile: onboarded })
  assert.equal(await afterSignInCore({ user: user('en'), locale: 'en', method: 'password', next: null }, viewer.ports), '/browse')
})

test('profile and admin lookups failing still sign in (logged, no name step, not admin)', async () => {
  const w = world({ getProfileThrows: true, ensureThrows: true, isAdmin: true })
  w.ports.isAdmin = async () => {
    throw new Error('admins down')
  }
  const dest = await afterSignInCore({ user: user('en'), locale: 'en', method: 'otp', next: null }, w.ports)
  assert.equal(dest, '/browse')
  assert.ok(w.errors.length >= 3)
  for (const line of w.errors) assert.ok(!line.includes('u1'))
})
