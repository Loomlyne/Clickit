import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

// Source-text guard (D-12): publish-scheduled refreshes the episodes and shows
// tags and the / and /coming-soon paths on every successful sweep, also when it
// published nothing (the frozen Vercel cron may have published the rows first).

const ROUTE = 'src/app/api/cron/publish-scheduled/route.ts'

function stripComments(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')
}

const code = stripComments(readFileSync(ROUTE, 'utf8'))

test('no episodeIds.length guard wraps the cache refresh', () => {
  assert.doesNotMatch(code, /if\s*\(\s*episodeIds\.length/)
  // The only remaining length check is the show promotion (showIds), not episodeIds.
  const updateTagAt = code.indexOf("updateTag('episodes')")
  assert.ok(updateTagAt > -1, "updateTag('episodes') present")
  const before = code.slice(0, updateTagAt)
  const lastBlockOpen = before.lastIndexOf('{')
  const lastBlockClose = before.lastIndexOf('}')
  // The nearest preceding brace must be a close: the call is not directly inside an if block.
  assert.ok(lastBlockClose > lastBlockOpen, 'updateTag is not the first statement of an open block')
})

test('all four refresh calls are present', () => {
  for (const call of [
    "updateTag('episodes')",
    "updateTag('shows')",
    "revalidatePath('/')",
    "revalidatePath('/coming-soon')",
  ]) {
    assert.ok(code.includes(call), `${call} present`)
  }
})

test('refresh runs after the epError early return and before the success JSON', () => {
  const errReturn = code.indexOf('if (epError)')
  const errReturnEnd = code.indexOf('}', code.indexOf('status: 500', errReturn))
  const refresh = code.indexOf("updateTag('episodes')")
  const success = code.indexOf('ok: true')
  assert.ok(errReturn > -1 && refresh > errReturnEnd, 'refresh after the epError return')
  assert.ok(success > refresh, 'success JSON after the refresh')
  for (const call of ["updateTag('shows')", "revalidatePath('/')", "revalidatePath('/coming-soon')"]) {
    const at = code.indexOf(call)
    assert.ok(at > errReturnEnd && at < success, `${call} between the error return and the success JSON`)
  }
})

test('refresh stays inside the try block', () => {
  const tryAt = code.indexOf('try {')
  const catchAt = code.indexOf('} catch')
  const refresh = code.indexOf("updateTag('episodes')")
  assert.ok(tryAt > -1 && catchAt > refresh && refresh > tryAt)
})
