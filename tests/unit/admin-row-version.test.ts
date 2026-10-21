// Deferred item 23 residual (b): admin form saves on app_config and shows are optimistic
// concurrency checks on updated_at. A stale form is refused with the existing conflict line and
// writes nothing; a fresh one returns the new updated_at so the next save from the same page
// does not falsely conflict. Pure core, fake Supabase with the BEFORE UPDATE trigger emulated.
import assert from 'node:assert/strict'
import test from 'node:test'
import {
  INVALID_UPDATED_AT,
  SAVE_CONFLICT,
  parseUpdatedAt,
  rowVersion,
  updateIfUnchanged,
} from '../../src/lib/admin/row-version.ts'
import { createVersionChain } from '../../src/lib/admin/version-chain.ts'
import { MEDIA_SAVE_CONFLICT } from '../../src/server/media-references.ts'
import { createFakeSupabase } from './helpers/fake-supabase.ts'

// The exact PostgREST JSON format of a timestamptz (microseconds, +00:00 offset).
const T0 = '2026-10-20T16:43:24.123456+00:00'

function world() {
  return createFakeSupabase(
    {
      app_config: [
        {
          id: 1,
          updated_at: T0,
          site_title: 'Clickit Story',
          site_tagline: 'Every Story Clicks.',
          footer_content: {
            tagline: 'old',
            social: [{ platform: 'x', url: 'https://x.com/a', iconUrl: 'https://media.test/site-assets/settings/social-icons/a.png' }],
          },
          cta_copy: null,
          genre_config: {},
          feature_flags: { showFaq: true },
          top_ticker: { enabled: false, items: [] },
        },
      ],
    },
    { updatedAtTables: ['app_config', 'shows'] }
  )
}

const cfg = (f: ReturnType<typeof world>) => f.tables.app_config![0]!

function version(value: string) {
  const v = rowVersion(value)
  assert.ok(v.ok, `rowVersion refused ${value}`)
  return v.value
}

test('the conflict line is the existing one (no new copy)', () => {
  assert.equal(SAVE_CONFLICT, MEDIA_SAVE_CONFLICT)
  assert.equal(SAVE_CONFLICT, 'This item changed while you were saving. Reload and try again.')
})

test('parseUpdatedAt keeps the exact PostgREST string (no Date round trip, no lost microseconds)', () => {
  for (const ok of [
    T0,
    '2026-10-20T16:43:24.12345+00:00',
    '2026-10-20T16:43:24+00:00',
    '2026-10-20T16:43:24.123456Z',
    '2026-10-20T20:43:24.123456+04:00',
  ]) {
    const r = parseUpdatedAt(ok)
    assert.deepEqual(r, { ok: true, value: ok }, ok)
  }
})

test('missing or invalid updated_at is refused (never an unchecked write)', () => {
  for (const bad of [
    undefined,
    null,
    '',
    ' ',
    0,
    1760978604123,
    {},
    new Date(T0),
    'yesterday',
    '2026-10-20',
    `${T0} OR 1=1`,
    '2026-10-20T16:43:24.1234567+00:00',
    `${T0}${'0'.repeat(50)}`,
  ]) {
    assert.deepEqual(parseUpdatedAt(bad), { ok: false, error: INVALID_UPDATED_AT }, String(bad))
    assert.equal(rowVersion(bad).ok, false)
  }
})

test('stale updated_at: refused with the conflict line, nothing written', async () => {
  const f = world()
  const before = f.snapshot()
  const stale = version('2026-10-20T16:43:20.000001+00:00')
  const r = await updateIfUnchanged(f.client, 'app_config', 1, { site_title: 'Mine' }, stale)
  assert.equal(r.error, SAVE_CONFLICT)
  assert.equal(stale.next, null)
  assert.deepEqual(f.snapshot(), before)
})

test('fresh updated_at: the update filters on the exact string and returns the new value', async () => {
  const f = world()
  const v = version(T0)
  const r = await updateIfUnchanged(f.client, 'app_config', 1, { site_title: 'Mine' }, v)
  assert.equal(r.error, null)
  assert.equal(cfg(f).site_title, 'Mine')
  assert.equal(typeof v.next, 'string')
  assert.notEqual(v.next, T0)
  assert.equal(v.next, cfg(f).updated_at)
  assert.match(v.next!, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}\+00:00$/)
  const update = f.calls.find((c) => c.table === 'app_config' && c.op === 'update')!
  assert.deepEqual(
    update.filters.filter((x) => x.col === 'updated_at'),
    [{ kind: 'eq', col: 'updated_at', value: T0 }]
  )
  assert.deepEqual(update.patch, { site_title: 'Mine' }, 'updated_at is never written by the app')
})

test('two sequential saves from one loaded page (metadata, then the footer jsonb) both succeed', async () => {
  const f = world()
  const page = createVersionChain()
  const first = version(page.resolve(T0))
  const a = await updateIfUnchanged(f.client, 'app_config', 1, { site_title: 'One' }, first)
  assert.equal(a.error, null)
  page.link(first.expected, first.next!)

  // The footer editor loaded with the page (T0); the chain hands it the value our own save produced.
  const second = version(page.resolve(T0))
  assert.equal(second.expected, first.next)
  const footer = { tagline: 'new', social: [{ platform: 'ig', url: 'https://instagram.com/a', iconUrl: '' }] }
  const b = await updateIfUnchanged(f.client, 'app_config', 1, { footer_content: footer }, second)
  assert.equal(b.error, null)
  page.link(second.expected, second.next!)
  assert.equal(cfg(f).site_title, 'One')
  assert.deepEqual(cfg(f).footer_content, footer)

  // A third save from the first editor also lands.
  const third = version(page.resolve(T0))
  assert.equal(third.expected, second.next)
  assert.equal((await updateIfUnchanged(f.client, 'app_config', 1, { site_title: 'Two' }, third)).error, null)
})

test('another admin saved in between: the page save is refused and their value stays', async () => {
  const f = world()
  const theirs = version(T0)
  assert.equal((await updateIfUnchanged(f.client, 'app_config', 1, { site_title: 'Theirs' }, theirs)).error, null)
  const mine = version(T0)
  const r = await updateIfUnchanged(f.client, 'app_config', 1, { site_title: 'Mine' }, mine)
  assert.equal(r.error, SAVE_CONFLICT)
  assert.equal(cfg(f).site_title, 'Theirs')
  assert.equal(cfg(f).updated_at, theirs.next)
})

test('every jsonb section of app_config is checked the same way (stale refused, fresh lands)', async () => {
  const sections: Array<Record<string, unknown>> = [
    { footer_content: { tagline: 't', social: [{ platform: 'x', url: '', iconUrl: 'https://media.test/new.png' }] } },
    { cta_copy: { zero: { label: 'a' } } },
    { genre_config: { Drama: { color: '#fff' } } },
    { feature_flags: { showFaq: false } },
    { top_ticker: { enabled: true, items: [{ tag: 'NEW', text: 'x' }] } },
  ]
  for (const patch of sections) {
    const f = world()
    const before = f.snapshot()
    const stale = await updateIfUnchanged(f.client, 'app_config', 1, patch, version('2026-10-20T16:43:24.123455+00:00'))
    assert.equal(stale.error, SAVE_CONFLICT, Object.keys(patch)[0])
    assert.deepEqual(f.snapshot(), before)
    const v = version(T0)
    const fresh = await updateIfUnchanged(f.client, 'app_config', 1, patch, v)
    assert.equal(fresh.error, null)
    const [col] = Object.keys(patch)
    assert.deepEqual(cfg(f)[col!], patch[col!])
    assert.equal(v.next, cfg(f).updated_at)
  }
})

test('a database error is returned as is and is not a conflict', async () => {
  const f = world()
  f.failOn({ table: 'app_config', op: 'update', nth: 1 })
  const r = await updateIfUnchanged(f.client, 'app_config', 1, { site_title: 'x' }, version(T0))
  assert.equal(r.error, 'forced failure')
})

test('version chain: only our own saves move a loaded editor forward', () => {
  const chain = createVersionChain()
  const T1 = '2026-10-20T16:43:25.000001+00:00'
  const T2 = '2026-10-20T16:43:26.000001+00:00'
  const P = '2026-10-20T16:43:27.5+00:00'
  assert.equal(chain.resolve(T0), T0)
  chain.link(T0, T1)
  chain.link(T1, T2)
  assert.equal(chain.resolve(T0), T2)
  assert.equal(chain.resolve(T1), T2)
  // An editor mounted from a fresh page read after another admin's save keeps its own base.
  assert.equal(chain.resolve(P), P)
  // A self link or an empty value never loops or erases a link.
  chain.link(T2, T2)
  chain.link(T2, '')
  assert.equal(chain.resolve(T0), T2)
})
