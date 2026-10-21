import { test } from 'node:test'
import assert from 'node:assert/strict'

import { planRenumber } from '../../src/lib/admin/renumber-plan.ts'

const ep = (id: string, n: number) => ({ id, title: `Episode ${id}`, episode_number: n })

test('planRenumber: exactly 1..N needs nothing', () => {
  const plan = planRenumber([ep('a', 1), ep('b', 2), ep('c', 3)])
  assert.equal(plan.needed, false)
  assert.deepEqual(plan.changes, [])
  assert.equal(plan.count, 3)
})

test('planRenumber: a gap lists only the episodes that move', () => {
  const plan = planRenumber([ep('a', 1), ep('b', 2), ep('c', 4), ep('d', 7)])
  assert.equal(plan.needed, true)
  assert.deepEqual(
    plan.changes.map((c) => [c.id, c.from, c.to]),
    [
      ['c', 4, 3],
      ['d', 7, 4],
    ]
  )
  assert.deepEqual(plan.numbers, [1, 2, 4, 7])
})

test('planRenumber: a season that starts above 1 is renumbered from 1', () => {
  const plan = planRenumber([ep('a', 3), ep('b', 4)])
  assert.equal(plan.needed, true)
  assert.deepEqual(
    plan.changes.map((c) => [c.from, c.to]),
    [
      [3, 1],
      [4, 2],
    ]
  )
})

test('planRenumber: unsorted input is read in number order and not mutated', () => {
  const input = [ep('b', 5), ep('a', 2)]
  const plan = planRenumber(input)
  assert.deepEqual(plan.changes.map((c) => c.id), ['a', 'b'])
  assert.equal(input[0].id, 'b')
})

test('planRenumber: an empty season needs nothing', () => {
  const plan = planRenumber([])
  assert.equal(plan.needed, false)
  assert.equal(plan.count, 0)
})
