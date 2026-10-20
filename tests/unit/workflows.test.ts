import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { test } from 'node:test'

// Text assertions on the workflow files. No YAML dependency and no workflow is
// ever run on GitHub to test these (D-06): shape is proven by string and regex checks.

const dir = new URL('../../.github/workflows/', import.meta.url)

function read(name: string) {
  return readFileSync(new URL(name, dir), 'utf8')
}

function jobIds(text: string) {
  const afterJobs = text.split(/^jobs:\s*$/m)[1] ?? ''
  return [...afterJobs.matchAll(/^ {2}([A-Za-z0-9_-]+):\s*$/gm)].map((m) => m[1])
}

function jobBlock(text: string, id: string) {
  const afterJobs = text.split(/^jobs:\s*$/m)[1] ?? ''
  const re = new RegExp(`^ {2}${id}:\\s*$([\\s\\S]*?)(?=^ {2}[A-Za-z0-9_-]+:\\s*$|(?![\\s\\S]))`, 'm')
  const m = afterJobs.match(re)
  assert.ok(m, `job ${id} not found`)
  return m[1]
}

function usesLines(text: string) {
  return [...text.matchAll(/^\s*-?\s*uses:\s*(\S+)/gm)].map((m) => m[1])
}

function assertAllPinned(text: string) {
  const uses = usesLines(text)
  assert.ok(uses.length > 0, 'expected at least one uses: line')
  for (const u of uses) assert.match(u, /@[0-9a-f]{40}$/, `unpinned action: ${u}`)
}

// ---------------------------------------------------------------- pr-gate.yml

const gate = () => read('pr-gate.yml')

test('pr-gate: triggers on pull_request opened/synchronize/reopened to main only', () => {
  const t = gate()
  assert.match(t, /^on:\s*\n\s+pull_request:/m)
  assert.match(t, /types:\s*\[opened, synchronize, reopened\]/)
  assert.match(t, /branches:\s*\[main\]/)
  assert.doesNotMatch(t, /^\s*paths:/m)
  assert.doesNotMatch(t, /paths-ignore/)
  assert.doesNotMatch(t, /pull_request_target/)
  assert.doesNotMatch(t, /^\s*push:/m)
  assert.doesNotMatch(t, /^\s*schedule:/m)
})

test('pr-gate: read-only token and no secrets', () => {
  const t = gate()
  assert.match(t, /^permissions:\s*\n\s+contents: read\s*$/m)
  assert.doesNotMatch(t, /secrets\./)
})

test('pr-gate: concurrency keyed on the PR number cancels in progress', () => {
  const t = gate()
  assert.match(t, /^concurrency:[\s\S]*?github\.event\.pull_request\.number[\s\S]*?cancel-in-progress: true/m)
})

test('pr-gate: jobs gate and migration-guard exist, named like their ids, Linux, with timeouts', () => {
  const t = gate()
  const ids = jobIds(t)
  assert.deepEqual(ids.sort(), ['gate', 'migration-guard'])
  for (const id of ids) {
    const b = jobBlock(t, id)
    assert.match(b, new RegExp(`^\\s+name: ${id}\\s*$`, 'm'))
    assert.match(b, /runs-on: ubuntu-latest/)
    assert.match(b, /timeout-minutes: \d+/)
  }
  assert.doesNotMatch(t, /macos|windows/i)
  const timeouts = t.match(/timeout-minutes:/g) ?? []
  assert.ok(timeouts.length >= ids.length)
})

test('pr-gate: every action is pinned to a 40-hex SHA and no cache input', () => {
  const t = gate()
  assertAllPinned(t)
  assert.doesNotMatch(t, /^\s*cache:/m)
})

test('pr-gate: both jobs check out with fetch-depth 2 and no persisted credentials', () => {
  const t = gate()
  for (const id of ['gate', 'migration-guard']) {
    const b = jobBlock(t, id)
    assert.match(b, /fetch-depth: 2/, `${id} fetch-depth`)
    assert.match(b, /persist-credentials: false/, `${id} persist-credentials`)
  }
})

test('pr-gate: gate always reports; heavy steps are gated by the scope step', () => {
  const t = gate()
  const b = jobBlock(t, 'gate')
  assert.doesNotMatch(b, /^\s{4}if:/m, 'gate job must have no job-level if')
  assert.match(b, /id: scope/)
  const cond = "if: steps.scope.outputs.code == 'true'"
  for (const cmd of ['npm ci', 'npm run lint', 'npm run typecheck', 'npm run test:unit', 'npm run build']) {
    const re = new RegExp(`${cond.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[\\s\\S]{0,400}?run: ${cmd}\\s*$`, 'm')
    assert.match(b, re, `${cmd} must carry the scope condition`)
  }
  assert.ok((t.match(/if: steps\.scope\.outputs\.code == 'true'/g) ?? []).length >= 6)
  for (const name of ['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY', 'NEXT_PUBLIC_SITE_URL']) {
    assert.match(b, new RegExp(`${name}:`))
  }
  assert.doesNotMatch(t, /gate:local/)
})

test('pr-gate: migration-guard runs the BASE copy of the guard, never the PR copy directly', () => {
  const t = gate()
  const b = jobBlock(t, 'migration-guard')
  assert.doesNotMatch(b, /^\s{4}if:/m, 'migration-guard must always run')
  assert.ok(t.includes('git cat-file -e HEAD^1:scripts/migration-guard.mjs'))
  assert.ok(t.includes('git show HEAD^1:scripts/migration-guard.mjs > "$RUNNER_TEMP/guard.mjs"'))
  assert.ok(t.includes('cp scripts/migration-guard.mjs "$RUNNER_TEMP/guard.mjs"'))
  assert.ok(t.includes('::warning::'))
  assert.ok(t.includes('node "$RUNNER_TEMP/guard.mjs" --base HEAD^1 --head HEAD'))
  assert.doesNotMatch(t, /node scripts\/migration-guard\.mjs/)
})
