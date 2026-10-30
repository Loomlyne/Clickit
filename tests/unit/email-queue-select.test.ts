import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { selectEmailQueue } from '../../src/server/email/queue-select.ts'
import type { QueueLike } from '../../src/server/cloudflare.ts'
import { nextBuildEnv, WORKER_BUILD_FLAG } from '../../scripts/cf/build-target.mjs'

function fakeQueue(tag: string): QueueLike & { tag: string } {
  return { tag, async send() {}, async sendBatch() {} }
}

function spyLoader(result: QueueLike) {
  const state = { calls: 0 }
  const loader = async () => {
    state.calls += 1
    return result
  }
  return { loader, state }
}

function stripComments(source: string): string {
  return source
    .split('\n')
    .filter((line) => !/^\s*(\/\/|\*|\/\*)/.test(line))
    .join('\n')
}

test('a bound queue is returned as-is and the loader is never called', async () => {
  const bound = fakeQueue('bound')
  const local = spyLoader(fakeQueue('local'))
  assert.equal(
    await selectEmailQueue({ bound, runtime: undefined, loadLocal: null }),
    bound
  )
  assert.equal(
    await selectEmailQueue({ bound, runtime: undefined, loadLocal: local.loader }),
    bound
  )
  assert.equal(local.state.calls, 0)
})

test('Worker build (no loader) without a binding fails closed', async () => {
  await assert.rejects(
    selectEmailQueue({ bound: undefined, runtime: undefined, loadLocal: null }),
    /EMAIL_QUEUE binding missing/
  )
})

test('runtime workers without a binding fails closed and never loads the fallback', async () => {
  const local = spyLoader(fakeQueue('local'))
  await assert.rejects(
    selectEmailQueue({ bound: undefined, runtime: 'workers', loadLocal: local.loader }),
    /EMAIL_QUEUE binding missing/
  )
  assert.equal(local.state.calls, 0)
})

test('node fallback path loads the in-process queue exactly once', async () => {
  for (const runtime of [undefined, 'node']) {
    const fake = fakeQueue('local')
    const local = spyLoader(fake)
    const got = await selectEmailQueue({ bound: undefined, runtime, loadLocal: local.loader })
    assert.equal(got, fake)
    assert.equal(local.state.calls, 1)
  }
})

test('queue.ts has no static import of consumer/deps and one guarded dynamic import', () => {
  const raw = readFileSync('src/server/email/queue.ts', 'utf8')
  const text = stripComments(raw)
  assert.doesNotMatch(text, /^import\s+(?!type\b).*from\s+'\.\/(consumer|deps)(\.ts)?'/m)
  assert.doesNotMatch(text, /^import\s+type\b.*from\s+'\.\/(consumer|deps)(\.ts)?'/m)
  const flagAt = text.indexOf(`process.env.CLICKIT_WORKER_BUILD === '1'`)
  assert.ok(flagAt >= 0, 'constant check present')
  const matches = text.match(/import\('\.\/queue-local\.ts'\)/g) ?? []
  assert.equal(matches.length, 1)
  assert.ok(text.indexOf(`import('./queue-local.ts')`) > flagAt, 'import after the constant check')
})

test('queue-local, next.config and custom-worker invariants', () => {
  const local = readFileSync('src/server/email/queue-local.ts', 'utf8')
  assert.match(local, /export function createInProcessQueue/)
  assert.match(local, /import \{ processBatch \} from '\.\/consumer\.ts'/)
  assert.match(local, /import \{ buildEmailDeps \} from '\.\/deps\.ts'/)
  const config = readFileSync('next.config.ts', 'utf8')
  assert.match(config, /defineServer/)
  assert.match(config, /'process\.env\.CLICKIT_WORKER_BUILD'/)
  const worker = readFileSync('custom-worker.ts', 'utf8')
  assert.match(worker, /import \{[^}]*processBatch[^}]*\} from '\.\/src\/server\/email\/consumer\.ts'/)
})

test('nextBuildEnv always sets the Worker build flag, applied last', () => {
  assert.equal(WORKER_BUILD_FLAG, 'CLICKIT_WORKER_BUILD')
  assert.deepEqual(nextBuildEnv({ HOME: 'h', PATH: 'p' }, { NEXT_PUBLIC_SITE_URL: 's' }), {
    HOME: 'h',
    PATH: 'p',
    NEXT_PUBLIC_SITE_URL: 's',
    CLICKIT_WORKER_BUILD: '1',
  })
  assert.equal(
    nextBuildEnv({ HOME: 'h' }, { CLICKIT_WORKER_BUILD: '' }).CLICKIT_WORKER_BUILD,
    '1'
  )
  const source = readFileSync('scripts/cf/build-target.mjs', 'utf8')
  assert.match(source, /spawnSync\('npx', \['opennextjs-cloudflare', 'build'\], \{\s*env: nextBuildEnv\(minimal, buildEnv\)/)
})
