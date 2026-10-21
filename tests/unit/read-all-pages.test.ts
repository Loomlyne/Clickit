// Paged reads past the PostgREST 1000-row cap (PR #27 review, finding 6):
// .order('id').range(from, from + 999) until a page comes back short.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

import { PAGE_SIZE, readAllPages } from '../../src/lib/admin/read-all-pages.ts'
import { createFakeSupabase, type Row } from './helpers/fake-supabase.ts'

const uuid = (n: number) => `eeeeeeee-0000-4000-8000-${String(n).padStart(12, '0')}`

function world(n: number) {
  // Inserted in reverse so only the order('id') gives a stable page order.
  const episodes: Row[] = Array.from({ length: n }, (_, i) => ({ id: uuid(n - i), archived: false }))
  return createFakeSupabase({ episodes })
}

const read = (fake: ReturnType<typeof world>) =>
  readAllPages<{ id: string }>((from, to) =>
    fake.client.from('episodes').select('id').order('id').range(from, to)
  )

const selects = (fake: ReturnType<typeof world>) =>
  fake.calls.filter((c) => c.table === 'episodes' && c.op === 'select').length

test('the page size is 1000 (the PostgREST cap)', () => {
  assert.equal(PAGE_SIZE, 1000)
})

for (const [n, pages] of [
  [0, 1],
  [999, 1],
  [1000, 2],
  [1001, 2],
  [2500, 3],
] as const) {
  test(`${n} rows: ${pages} page(s), every row once, in id order`, async () => {
    const fake = world(n)
    const res = await read(fake)
    assert.equal(res.error, null)
    assert.equal(res.data!.length, n)
    assert.equal(new Set(res.data!.map((r) => r.id)).size, n)
    assert.deepEqual(
      res.data!.map((r) => r.id),
      Array.from({ length: n }, (_, i) => uuid(i + 1))
    )
    assert.equal(selects(fake), pages)
  })
}

test('asks for consecutive inclusive ranges', async () => {
  const asked: Array<[number, number]> = []
  const res = await readAllPages<number>(async (from, to) => {
    asked.push([from, to])
    const all = Array.from({ length: 25 }, (_, i) => i)
    return { data: all.slice(from, to + 1), error: null }
  }, 10)
  assert.deepEqual(asked, [
    [0, 9],
    [10, 19],
    [20, 29],
  ])
  assert.equal(res.data!.length, 25)
})

test('an error on any page returns the error and no partial data', async () => {
  const fake = world(2500)
  fake.failOn({ table: 'episodes', op: 'select', nth: 2 })
  const res = await read(fake)
  assert.equal(res.data, null)
  assert.deepEqual(res.error, { message: 'forced failure' })
  assert.equal(selects(fake), 2)
})

test('a null page is an empty last page', async () => {
  const res = await readAllPages<number>(async () => ({ data: null, error: null }))
  assert.deepEqual(res, { data: [], error: null })
})

test('a page size below 1 is refused', async () => {
  await assert.rejects(() => readAllPages(async () => ({ data: [], error: null }), 0))
})

test('the admin dashboard pages its YouTube health read in id order', () => {
  const page = readFileSync('src/app/[locale]/admin/page.tsx', 'utf8')
  assert.match(page, /import \{ readAllPages \} from '@\/lib\/admin\/read-all-pages'/)
  const at = page.indexOf('readAllPages((from, to) =>')
  assert.ok(at !== -1, 'dashboard does not use readAllPages')
  const call = page.slice(at, page.indexOf('),', page.indexOf('.range(from, to)', at)))
  assert.ok(call.includes(".from('episodes')"))
  assert.ok(call.includes(".eq('archived', false)"))
  assert.ok(call.includes(".order('id')"))
  assert.ok(call.includes('.range(from, to)'))
})
