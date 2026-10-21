import assert from 'node:assert/strict'
import test from 'node:test'
import {
  ARABIC_FILL_RATE_KEY,
  ARABIC_FILL_RATE_LIMIT,
  ARABIC_FILL_RATE_WINDOW_MS,
  arabicFillRateIp,
  createArabicFillerCore,
} from '../../src/lib/admin/arabic-filler.ts'
import { arabicMissingOf, withArabicMissing } from '../../src/lib/admin/arabic-missing.ts'
import { createSeasonCore } from '../../src/lib/admin/season-episode-writes.ts'
import type { AiBinding } from '../../src/lib/arabic-text.ts'
import type { RateLimitStore } from '../../src/server/rate-limit-policy.ts'
import { createFakeSupabase } from './helpers/fake-supabase.ts'

const openAi = (content: string) => ({ choices: [{ message: { role: 'assistant', content }, finish_reason: 'stop' }] })

function fakeAi(reply: (text: string) => unknown = () => openAi('نص عربي')) {
  let calls = 0
  const ai: AiBinding = {
    async run(_model, input) {
      calls += 1
      const messages = (input as { messages: Array<{ content: string }> }).messages
      return reply(messages[1]!.content)
    },
  }
  return { ai, calls: () => calls }
}

function memoryStore(opts: { count?: number; countThrows?: boolean; recordThrows?: boolean } = {}) {
  const seen: Array<{ op: string; ip: string; key: string; sinceIso?: string }> = []
  const store: RateLimitStore = {
    async count(ip, key, sinceIso) {
      seen.push({ op: 'count', ip, key, sinceIso })
      if (opts.countThrows) throw new Error('rate_limits count failed')
      return opts.count ?? 0
    },
    async record(ip, key) {
      seen.push({ op: 'record', ip, key })
      if (opts.recordThrows) throw new Error('rate_limits insert failed')
    },
  }
  return { store, seen }
}

const NOW = Date.parse('2026-10-20T12:00:00.000Z')

function filler(over: {
  ai?: AiBinding | undefined
  store?: RateLimitStore
  getStore?: () => RateLimitStore
  userId?: string | null
} = {}) {
  const a = 'ai' in over ? over.ai : fakeAi().ai
  const s = over.store ?? memoryStore().store
  return createArabicFillerCore({
    userId: over.userId === undefined ? 'admin-1' : over.userId,
    getAi: async () => a,
    getStore: over.getStore ?? (() => s),
    now: () => NOW,
  })
}

test('rate limit constants: 60 AI calls per admin per 10 minutes, key translate-ar', () => {
  assert.equal(ARABIC_FILL_RATE_LIMIT, 60)
  assert.equal(ARABIC_FILL_RATE_WINDOW_MS, 10 * 60 * 1000)
  assert.equal(ARABIC_FILL_RATE_KEY, 'translate-ar')
  assert.equal(arabicFillRateIp('u-1'), 'admin:u-1')
})

test('fill keeps an existing Arabic value and makes no call', async () => {
  const ai = fakeAi()
  const { store, seen } = memoryStore()
  const f = filler({ ai: ai.ai, store })
  assert.equal(await f.fill('Hello', '  مرحبا '), 'مرحبا')
  assert.equal(await f.fill('', null), null)
  assert.equal(await f.fill(null, undefined), null)
  assert.equal(ai.calls(), 0)
  assert.equal(seen.length, 0)
  assert.equal(f.missing(), 0)
})

test('fill translates through the rate limit with ip admin:<userId> and key translate-ar', async () => {
  const ai = fakeAi()
  const { store, seen } = memoryStore()
  const f = filler({ ai: ai.ai, store })
  assert.equal(await f.fill('Hello', null), 'نص عربي')
  assert.equal(ai.calls(), 1)
  assert.deepEqual(seen.map((s) => [s.op, s.ip, s.key]), [
    ['count', 'admin:admin-1', 'translate-ar'],
    ['record', 'admin:admin-1', 'translate-ar'],
  ])
  assert.equal(seen[0]!.sinceIso, new Date(NOW - 10 * 60 * 1000).toISOString())
  assert.equal(f.missing(), 0)
})

test('rate limited: null, counted as missing, ai.run not called', async () => {
  const ai = fakeAi()
  const f = filler({ ai: ai.ai, store: memoryStore({ count: 60 }).store })
  assert.equal(await f.fill('Hello', null), null)
  assert.equal(ai.calls(), 0)
  assert.equal(f.missing(), 1)
})

test('store error (count, record or init): null, ai.run not called', async () => {
  for (const store of [memoryStore({ countThrows: true }).store, memoryStore({ recordThrows: true }).store]) {
    const ai = fakeAi()
    const f = filler({ ai: ai.ai, store })
    assert.equal(await f.fill('Hello', null), null)
    assert.equal(ai.calls(), 0)
    assert.equal(f.missing(), 1)
  }
  const ai = fakeAi()
  const f = filler({ ai: ai.ai, getStore: () => { throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set') } })
  assert.equal(await f.fill('Hello', null), null)
  assert.equal(ai.calls(), 0)
})

test('no admin user id: null, nothing called', async () => {
  const ai = fakeAi()
  const { store, seen } = memoryStore()
  const f = filler({ ai: ai.ai, store, userId: '' })
  assert.equal(await f.fill('Hello', null), null)
  assert.equal(ai.calls(), 0)
  assert.equal(seen.length, 0)
})

test('missing AI binding: null, rate limit not consumed', async () => {
  const { store, seen } = memoryStore()
  const f = filler({ ai: undefined, store })
  assert.equal(await f.fill('Hello', null), null)
  assert.equal(seen.length, 0)
  assert.equal(f.missing(), 1)
})

test('AI failure: null, never English, counted', async () => {
  const echo = fakeAi((t) => openAi(t))
  const f = filler({ ai: echo.ai })
  assert.equal(await f.fill('Hello', null), null)
  const throws: AiBinding = { run: async () => { throw new Error('x') } }
  assert.equal(await f.fill('World', ''), null)
  const f2 = filler({ ai: throws })
  assert.equal(await f2.fill('Hello', null), null)
  assert.equal(f.missing(), 2)
  assert.equal(f2.missing(), 1)
})

test('fillBatch: per-slot results, blanks not sent and not counted', async () => {
  const ai = fakeAi((t) => openAi(t === 'bad' ? 'bad' : 'نص'))
  const f = filler({ ai: ai.ai })
  assert.deepEqual(await f.fillBatch(['a', '', 'bad']), ['نص', null, null])
  assert.equal(ai.calls(), 2)
  assert.equal(f.missing(), 1)
})

test('withArabicMissing / arabicMissingOf', () => {
  assert.deepEqual(withArabicMissing({ success: true }, 0), { success: true })
  assert.deepEqual(withArabicMissing({ success: true, data: 1 }, 2), { success: true, data: 1, arabicMissing: 2 })
  assert.deepEqual(withArabicMissing({ success: false, error: 'x' }, 2), { success: false, error: 'x' })
  assert.equal(arabicMissingOf({ success: true, arabicMissing: 3 }), 3)
  assert.equal(arabicMissingOf({ success: true }), 0)
  assert.equal(arabicMissingOf({ success: false, arabicMissing: 3 }), 0)
  assert.equal(arabicMissingOf({ success: true, arabicMissing: 'x' }), 0)
  assert.equal(arabicMissingOf(null), 0)
})

test('an admin save reports how many Arabic fields could not be filled (createSeason path)', async () => {
  const S1 = 'aaaaaaaa-0000-4000-8000-000000000000'
  const f = createFakeSupabase({
    shows: [{ id: S1, title: 'Show 1', season_count: 0, episode_count: 0 }],
    seasons: [],
    episodes: [],
  })
  const fill = filler({ ai: { run: async () => { throw new Error('4006') } } })
  const res = await createSeasonCore(
    f.client,
    { audit: f.auditWriter, adminUserId: 'admin-1', fillArabic: fill.fill },
    { show_id: S1, title: 'Season 1', season_number: 1 }
  )
  assert.equal(res.success, true)
  const season = f.snapshot().seasons![0]!
  assert.equal(season.title_ar, null, 'field stays empty, never English')
  const out = withArabicMissing(res, fill.missing())
  assert.equal(out.arabicMissing, 1)
  assert.equal(arabicMissingOf(out), 1)
})

// ---- schema max length (review item 7, PR #29) ------------------------------

test('fill: a translation longer than the field max is null and counted missing', async () => {
  const ai = fakeAi(() => openAi('نص عربي طويل جدا'))
  const f = filler({ ai: ai.ai })
  assert.equal(await f.fill('Long text', null, 5), null)
  assert.equal(f.missing(), 1)
  assert.equal(await f.fill('Long text', null, 200), 'نص عربي طويل جدا')
  assert.equal(await f.fill('Long text', null), 'نص عربي طويل جدا')
  assert.equal(f.missing(), 1)
})

test('fill: an Arabic value the admin typed is kept as is (the schema already checked it)', async () => {
  const ai = fakeAi()
  const f = filler({ ai: ai.ai })
  assert.equal(await f.fill('Hi', 'مرحبا بكم', 3), 'مرحبا بكم')
  assert.equal(ai.calls(), 0)
  assert.equal(f.missing(), 0)
})

test('fillBatch: per-slot max lengths; an over-long slot is null and counted', async () => {
  const ai = fakeAi((text) => openAi(text === 'Tag' ? 'وسم طويل جدا جدا' : 'نص'))
  const f = filler({ ai: ai.ai })
  assert.deepEqual(await f.fillBatch(['Tag', 'Text'], [4, 240]), [null, 'نص'])
  assert.equal(f.missing(), 1)
})
