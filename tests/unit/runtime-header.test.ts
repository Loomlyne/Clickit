import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { RUNTIME_HEADER, withRuntimeHeader } from '../../src/server/runtime-header.ts'

test('RUNTIME_HEADER is x-clickit-runtime', () => {
  assert.equal(RUNTIME_HEADER, 'x-clickit-runtime')
})

test('adds x-clickit-runtime: workers and keeps body and status', async () => {
  const out = withRuntimeHeader(new Response('hello', { status: 200 }))
  assert.equal(out.headers.get('x-clickit-runtime'), 'workers')
  assert.equal(out.status, 200)
  assert.equal(await out.text(), 'hello')
})

test('keeps status text and the other headers', () => {
  const src = new Response('x', {
    status: 404,
    statusText: 'Not Found',
    headers: { 'content-type': 'text/html', 'cache-control': 'no-store' },
  })
  const out = withRuntimeHeader(src)
  assert.equal(out.status, 404)
  assert.equal(out.statusText, 'Not Found')
  assert.equal(out.headers.get('content-type'), 'text/html')
  assert.equal(out.headers.get('cache-control'), 'no-store')
})

test('overwrites an upstream value of the marker instead of trusting it', () => {
  const out = withRuntimeHeader(new Response('x', { headers: { 'x-clickit-runtime': 'vercel' } }))
  assert.equal(out.headers.get('x-clickit-runtime'), 'workers')
})

test('a response with immutable headers is copied, not mutated', () => {
  const src = Response.redirect('https://www.clickitstory.ae/en', 301)
  assert.throws(() => src.headers.set('x-probe', '1'), 'fixture must have immutable headers')
  const out = withRuntimeHeader(src)
  assert.notEqual(out, src)
  assert.equal(out.status, 301)
  assert.equal(out.headers.get('location'), 'https://www.clickitstory.ae/en')
  assert.equal(out.headers.get('x-clickit-runtime'), 'workers')
  assert.equal(src.headers.get('x-clickit-runtime'), null)
})

test('a 101 upgrade response is returned untouched', () => {
  const upgrade = { status: 101, headers: new Headers(), webSocket: {} } as unknown as Response
  const out = withRuntimeHeader(upgrade)
  assert.equal(out, upgrade)
  assert.equal(out.headers.get('x-clickit-runtime'), null)
})

test('a response carrying a webSocket is returned untouched', () => {
  const ws = { status: 200, headers: new Headers(), webSocket: {} } as unknown as Response
  assert.equal(withRuntimeHeader(ws), ws)
})

test('a streamed body passes through without being buffered first', async () => {
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new TextEncoder().encode('part-1;'))
      controller.enqueue(new TextEncoder().encode('part-2'))
      controller.close()
    },
  })
  const src = new Response(stream, { status: 200 })
  const out = withRuntimeHeader(src)
  assert.equal(await out.text(), 'part-1;part-2')
})

test('a null-body response (204) stays a null-body response', () => {
  const out = withRuntimeHeader(new Response(null, { status: 204 }))
  assert.equal(out.status, 204)
  assert.equal(out.body, null)
  assert.equal(out.headers.get('x-clickit-runtime'), 'workers')
})

test('custom-worker.ts wraps the handler result and keeps the cron handler', () => {
  const src = readFileSync(new URL('../../custom-worker.ts', import.meta.url), 'utf8')
  assert.match(src, /import \{[^}]*withRuntimeHeader[^}]*\} from '\.\/src\/server\/runtime-header\.ts'/)
  assert.match(src, /withRuntimeHeader\(\s*await handler\.fetch\(/)
  assert.doesNotMatch(src, /fetch:\s*handler\.fetch\b/)
  assert.match(src, /async scheduled\(/)
  assert.match(src, /runCron\(/)
})
