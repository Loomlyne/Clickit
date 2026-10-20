import assert from 'node:assert/strict'
import test from 'node:test'
import { createFakeSupabase } from './helpers/fake-supabase.ts'

const S1 = '11111111-1111-4111-8111-111111111111'
const S2 = '22222222-2222-4222-8222-222222222222'

function seed() {
  return createFakeSupabase({
    shows: [
      { id: 'a', title: 'A', slug: 'a', archived: false, season_count: 1 },
      { id: 'b', title: 'B', slug: 'b', archived: true, season_count: 2 },
      { id: 'c', title: 'C', slug: 'c', archived: false, season_count: 3 },
    ],
    episodes: [
      { id: 'e1', season_id: S1, episode_number: 1, archived: false },
      { id: 'e2', season_id: S1, episode_number: 2, archived: true },
      { id: 'e3', season_id: S2, episode_number: 1, archived: false },
    ],
  })
}

test('select filters eq/neq/in/is/not-null/gt/lt, order, limit', async () => {
  const f = seed()
  const c = f.client
  const r1 = await c.from('shows').select('id').eq('archived', false)
  assert.deepEqual(r1.data.map((r) => r.id), ['a', 'c'])
  const r2 = await c.from('shows').select('id').neq('id', 'a')
  assert.equal(r2.data.length, 2)
  const r3 = await c.from('shows').select('id').in('id', ['a', 'b'])
  assert.equal(r3.data.length, 2)
  const r4 = await c.from('shows').select('id').is('title_ar', null)
  assert.equal(r4.data.length, 3)
  const r5 = await c.from('shows').select('id').not('title', 'is', null)
  assert.equal(r5.data.length, 3)
  const r6 = await c.from('shows').select('id').gt('season_count', 1)
  assert.equal(r6.data.length, 2)
  const r7 = await c.from('shows').select('id').lt('season_count', 3)
  assert.equal(r7.data.length, 2)
  const r8 = await c
    .from('shows')
    .select('id')
    .order('season_count', { ascending: false })
    .limit(1)
  assert.deepEqual(r8.data.map((r) => r.id), ['c'])
})

test('single errors PGRST116 on 0 or many rows; maybeSingle returns null', async () => {
  const f = seed()
  const c = f.client
  const none = await c.from('shows').select('*').eq('id', 'zzz').single()
  assert.equal(none.error.code, 'PGRST116')
  const many = await c.from('shows').select('*').single()
  assert.equal(many.error.code, 'PGRST116')
  const one = await c.from('shows').select('*').eq('id', 'a').single()
  assert.equal(one.data.id, 'a')
  const mb = await c.from('shows').select('*').eq('id', 'zzz').maybeSingle()
  assert.equal(mb.data, null)
  assert.equal(mb.error, null)
})

test('count head returns count and null data', async () => {
  const f = seed()
  const c = f.client
  const r = await c
    .from('episodes')
    .select('id', { count: 'exact', head: true })
    .eq('archived', false)
  assert.equal(r.count, 2)
  assert.equal(r.data, null)
  assert.equal(r.error, null)
})

test('eq on JSON path diff->>outcome', async () => {
  const f = createFakeSupabase({
    admin_audit_log: [
      { id: '1', diff: { outcome: 'committed' } },
      { id: '2', diff: { outcome: 'failed' } },
    ],
  })
  const r = await (f.client)
    .from('admin_audit_log')
    .select('id')
    .eq('diff->>outcome', 'committed')
  assert.deepEqual(r.data.map((x) => x.id), ['1'])
})

test('update/delete apply to filtered rows; data only with select()', async () => {
  const f = seed()
  const c = f.client
  const u = await c.from('shows').update({ title: 'Z' }).eq('id', 'a')
  assert.equal(u.error, null)
  assert.equal(u.data, null)
  assert.equal(f.tables.shows.find((s) => s.id === 'a').title, 'Z')
  assert.equal(f.tables.shows.find((s) => s.id === 'c').title, 'C')
  const u2 = await c.from('shows').update({ title: 'Y' }).eq('id', 'c').select()
  assert.equal(u2.data.length, 1)
  const d = await c.from('shows').delete().eq('id', 'b').select()
  assert.equal(d.data.length, 1)
  assert.equal(f.tables.shows.length, 2)
})

test('insert assigns uuid id and created_at', async () => {
  const f = seed()
  const r = await (f.client)
    .from('shows')
    .insert({ title: 'N', slug: 'n' })
    .select()
    .single()
  assert.match(r.data.id, /^[0-9a-f-]{36}$/)
  assert.ok(r.data.created_at)
  assert.equal(f.tables.shows.length, 4)
})

test('duplicate (season_id, episode_number) returns 23505 and leaves table unchanged', async () => {
  const f = seed()
  const c = f.client
  const before = f.snapshot()
  const r = await c
    .from('episodes')
    .insert({ season_id: S1, episode_number: 1 })
  assert.equal(r.error.code, '23505')
  assert.deepEqual(f.snapshot(), before)
  const u = await c
    .from('episodes')
    .update({ episode_number: 2 })
    .eq('id', 'e1')
  assert.equal(u.error.code, '23505')
  assert.deepEqual(f.snapshot(), before)
})

test('duplicate shows.slug returns 23505', async () => {
  const f = seed()
  const r = await (f.client)
    .from('shows')
    .insert({ title: 'X', slug: 'a' })
  assert.equal(r.error.code, '23505')
  assert.equal(f.tables.shows.length, 3)
})

test('failOn nth makes only the nth matching op fail', async () => {
  const f = seed()
  const c = f.client
  f.failOn({ table: 'episodes', op: 'update', nth: 2 })
  const a = await c.from('episodes').update({ title: 'x' }).eq('id', 'e1')
  assert.equal(a.error, null)
  const b = await c.from('episodes').update({ title: 'y' }).eq('id', 'e3')
  assert.equal(b.error.message, 'forced failure')
  assert.equal(f.tables.episodes.find((e) => e.id === 'e3').title, undefined)
  const d = await c.from('episodes').update({ title: 'z' }).eq('id', 'e3')
  assert.equal(d.error, null)
})

test('throwOn throws on the nth op', async () => {
  const f = seed()
  f.throwOn({ table: 'shows', op: 'delete', nth: 1 })
  await assert.rejects(async () => {
    await (f.client).from('shows').delete().eq('id', 'a')
  })
  assert.equal(f.tables.shows.length, 3)
})

test('snapshot excludes tables and is a deep copy', async () => {
  const f = seed()
  const snap = f.snapshot({ exclude: ['admin_audit_log'] })
  assert.equal('admin_audit_log' in snap, false)
  f.tables.shows[0].title = 'changed'
  assert.equal(snap.shows[0].title, 'A')
})

test('auditWriter inserts rows with increasing created_at; failOn nth fails', async () => {
  const f = seed()
  const e = { adminUserId: 'u', action: 'delete', entity: 'episode', entityId: null } as const
  const r1 = await f.auditWriter({ ...e, diff: { n: 1 } })
  const r2 = await f.auditWriter({ ...e, diff: { n: 2 } })
  assert.equal(r1.error, null)
  assert.equal(r2.error, null)
  assert.ok(f.auditRows()[0].created_at < f.auditRows()[1].created_at)
  f.failOn({ table: 'admin_audit_log', op: 'insert', nth: 3 })
  const r3 = await f.auditWriter({ ...e, diff: { n: 3 } })
  assert.equal(r3.error, 'forced failure')
  assert.equal(f.auditRows().length, 2)
})

test('registerRpc handler runs; unregistered returns PGRST202; failOn rpc', async () => {
  const f = seed()
  const c = f.client
  f.registerRpc('bump', (args, tables) => {
    tables.shows.find((s) => s.id === args.id).season_count = 99
    return { data: 'ok', error: null }
  })
  const ok = await c.rpc('bump', { id: 'a' })
  assert.equal(ok.data, 'ok')
  assert.equal(f.tables.shows[0].season_count, 99)
  const missing = await c.rpc('nope', {})
  assert.equal(missing.error.code, 'PGRST202')
  f.failOn({ rpc: 'bump', nth: 2 })
  const bad = await c.rpc('bump', { id: 'a' })
  assert.equal(bad.error.message, 'forced failure')
})

test('calls records ordered ops', async () => {
  const f = seed()
  const c = f.client
  await c.from('shows').update({ title: 'Q' }).eq('id', 'a')
  await c.from('shows').delete().eq('id', 'c')
  const ops = f.calls.map((x) => x.op)
  assert.deepEqual(ops, ['update', 'delete'])
  assert.equal(f.calls[0].table, 'shows')
})
