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

/** The literal `run: |` block of the step whose `id:` or `name:` line matches `marker`. */
function runBlockOf(text: string, marker: RegExp) {
  const lines = text.split('\n')
  const at = lines.findIndex((l) => marker.test(l))
  assert.ok(at >= 0, `step ${marker} not found`)
  const runAt = lines.findIndex((l, i) => i > at && /^\s+run: \|\s*$/.test(l))
  assert.ok(runAt > at, `run block for ${marker} not found`)
  const indent = (lines[runAt + 1].match(/^ */) ?? [''])[0].length
  const body: string[] = []
  for (const line of lines.slice(runAt + 1)) {
    if (line.trim() !== '' && (line.match(/^ */) ?? [''])[0].length < indent) break
    body.push(line.slice(indent))
  }
  return body.join('\n')
}

test('pr-gate (WR-02): scope step fails closed and ignores rename detection', () => {
  const script = runBlockOf(jobBlock(gate(), 'gate'), /id: scope/)
  assert.match(script, /^set -euo pipefail$/m)
  assert.ok(script.includes('git diff --no-renames --name-only HEAD^1 HEAD'))
  assert.doesNotMatch(gate(), /git diff --name-only/)
  // the git-failure branch writes code=true
  assert.match(script, /if ! changed="\$\(git diff[^\n]*\)"; then\n[^\n]*\n\s*echo "code=true"/)
})

test('pr-gate (WR-02): scope step classifies real change sets (run locally with bash)', async () => {
  const { mkdtemp, mkdir, writeFile, readFile, rm } = await import('node:fs/promises')
  const { tmpdir } = await import('node:os')
  const { join } = await import('node:path')
  const { execFileSync, spawnSync } = await import('node:child_process')
  const script = runBlockOf(jobBlock(gate(), 'gate'), /id: scope/)
  const env = {
    ...process.env,
    GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@example.test',
    GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@example.test',
  }
  const git = (cwd: string, ...args: string[]) => execFileSync('git', args, { cwd, env, stdio: 'ignore' })
  async function classify(setup: (repo: string) => Promise<void>, twoCommits = true) {
    const repo = await mkdtemp(join(tmpdir(), 'scope-'))
    try {
      git(repo, 'init', '-q', '-b', 'main')
      await mkdir(join(repo, 'src'), { recursive: true })
      await mkdir(join(repo, 'docs'), { recursive: true })
      await writeFile(join(repo, 'src', 'a.ts'), 'export const a = 1\n')
      await writeFile(join(repo, 'README.md'), '# r\n')
      git(repo, 'add', '-A')
      git(repo, 'commit', '-q', '-m', 'base')
      if (twoCommits) {
        await setup(repo)
        git(repo, 'add', '-A')
        git(repo, 'commit', '-q', '-m', 'head')
      }
      const out = join(repo, '.gh-output')
      await writeFile(out, '')
      const r = spawnSync('bash', ['-c', script], { cwd: repo, env: { ...env, GITHUB_OUTPUT: out }, encoding: 'utf8' })
      assert.equal(r.status, 0, r.stdout + r.stderr)
      return (await readFile(out, 'utf8')).trim()
    } finally {
      await rm(repo, { recursive: true, force: true })
    }
  }
  // moving code into docs/ is a code change (rename detection would hide it)
  assert.equal(
    await classify(async (repo) => git(repo, 'mv', 'src/a.ts', 'docs/a.md')),
    'code=true',
  )
  assert.equal(
    await classify(async (repo) => writeFile(join(repo, 'README.md'), '# r\nmore\n')),
    'code=false',
  )
  assert.equal(
    await classify(async (repo) => writeFile(join(repo, 'src', 'a.ts'), 'export const a = 2\n')),
    'code=true',
  )
  // git error (no HEAD^1): fail closed, run everything
  assert.equal(await classify(async () => {}, false), 'code=true')
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

// ------------------------------------------------------ apply-live-migrations.yml

const apply = () => read('apply-live-migrations.yml')

test('apply: old auto-apply file is gone and the new file is named', () => {
  assert.equal(existsSync(new URL('supabase-migrations.yml', dir)), false)
  assert.match(apply(), /^name: Apply live migrations\s*$/m)
})

test('apply: only trigger is workflow_dispatch', () => {
  const t = apply()
  assert.match(t, /^on:\s*\n\s+workflow_dispatch:/m)
  assert.doesNotMatch(t, /^\s*push:/m)
  assert.doesNotMatch(t, /^\s*pull_request/m)
  assert.doesNotMatch(t, /^\s*schedule:/m)
})

test('apply: forbidden flags never appear, not even in comments', () => {
  const t = apply()
  for (const flag of ['--include-all', '--include-seed', '--debug']) {
    assert.ok(!t.includes(flag), `${flag} must not appear`)
  }
})

test('apply: dry-run then apply, chained by needs and the pending output', () => {
  const t = apply()
  assert.deepEqual(jobIds(t).sort(), ['apply', 'dry-run'])
  const a = jobBlock(t, 'apply')
  assert.match(a, /^\s+needs: dry-run\s*$/m)
  assert.match(a, /^\s+if: needs\.dry-run\.outputs\.pending == 'true'\s*$/m)
  assert.match(jobBlock(t, 'dry-run'), /outputs:\s*\n\s+pending: \$\{\{ steps\.plan\.outputs\.pending \}\}/)
})

test('apply: dry-run uses live-db-plan, apply uses live-db', () => {
  const t = apply()
  assert.match(jobBlock(t, 'dry-run'), /^\s+environment: live-db-plan\s*$/m)
  assert.match(jobBlock(t, 'apply'), /^\s+environment: live-db\s*$/m)
  assert.equal((t.match(/environment: live-db$/gm) ?? []).length, 1)
  assert.equal((t.match(/environment: live-db-plan/g) ?? []).length, 1)
})

test('apply: exact dry-run and apply commands', () => {
  const t = apply()
  assert.ok(t.includes('supabase db push --dry-run --db-url "$SUPABASE_DB_URL"'))
  assert.match(t, /^\s+run: supabase db push --db-url "\$SUPABASE_DB_URL" --yes\s*$/m)
  assert.match(t, /Remote database is up to date/)
  assert.match(t, /set -o pipefail/)
})

test('apply: both jobs refuse to run off main', () => {
  const t = apply()
  for (const id of ['dry-run', 'apply']) {
    const b = jobBlock(t, id)
    assert.match(b, /\$GITHUB_REF/, `${id} checks GITHUB_REF`)
    assert.ok(b.includes('refs/heads/main'), `${id} names refs/heads/main`)
    assert.match(b, /exit 1/)
  }
})

test('apply: pg_dump_taken input exists and apply fails unless it is true', () => {
  const t = apply()
  assert.match(t, /^\s+pg_dump_taken:\s*\n(?:\s+.*\n){0,6}?\s+type: boolean/m)
  assert.match(t, /required: true/)
  assert.match(t, /default: false/)
  const b = jobBlock(t, 'apply')
  assert.ok(b.includes('${{ inputs.pg_dump_taken }}'))
  assert.match(b, /::error::Take a local pg_dump first/)
})

test('apply (CR-02): comments name the real protection, not the main-only step', () => {
  const t = apply()
  assert.doesNotMatch(t, /main-only step still limits/)
  assert.doesNotMatch(t, /repo-level\s+#?\s*SUPABASE_DB_URL, and/)
  assert.match(t, /diagnostics, not protection/)
  assert.match(t, /ONLY as an environment secret/)
  assert.match(t, /deployments from `main` only/)
})

test('apply (WR-03): apply job refuses to write unless live-db has a required reviewer', () => {
  const t = apply()
  const a = jobBlock(t, 'apply')
  assert.match(a, /^ {4}permissions:\s*\n {6}contents: read\s*\n {6}actions: read\s*$/m)
  const check = a.indexOf('name: live-db must require a reviewer')
  const write = a.indexOf('supabase db push --db-url')
  assert.ok(check > 0 && write > check, 'reviewer check must come before the apply command')
  assert.ok(a.includes('GH_TOKEN: ${{ github.token }}'))
  const script = runBlockOf(a, /name: live-db must require a reviewer/)
  assert.match(script, /^set -euo pipefail$/m)
  assert.ok(script.includes('"$GITHUB_API_URL/repos/$GITHUB_REPOSITORY/environments/live-db"'))
  assert.match(script, /curl -fsS/)
  assert.ok(script.includes(`.type == "required_reviewers"`))
  assert.match(script, /jq -e/)
})

test('apply (WR-03): reviewer check run locally with a fake curl', async () => {
  const { mkdtemp, writeFile, chmod, rm } = await import('node:fs/promises')
  const { tmpdir } = await import('node:os')
  const { join } = await import('node:path')
  const { spawnSync } = await import('node:child_process')
  const jq = spawnSync('jq', ['--version'])
  if (jq.status !== 0) return // jq is on ubuntu-latest; skip locally if absent
  const script = runBlockOf(jobBlock(apply(), 'apply'), /name: live-db must require a reviewer/)
  const bin = await mkdtemp(join(tmpdir(), 'fakecurl-'))
  try {
    async function run(body: string, curlExit = 0) {
      const fake = join(bin, 'curl')
      await writeFile(fake, `#!/bin/sh\ncat <<'JSON'\n${body}\nJSON\nexit ${curlExit}\n`)
      await chmod(fake, 0o755)
      return spawnSync('bash', ['-c', script], {
        env: {
          ...process.env,
          PATH: `${bin}:${process.env.PATH}`,
          GH_TOKEN: 'x',
          GITHUB_API_URL: 'https://api.github.com',
          GITHUB_REPOSITORY: 'o/r',
        },
        encoding: 'utf8',
      }).status
    }
    const ok = '{"protection_rules":[{"type":"branch_policy"},{"type":"required_reviewers","reviewers":[{}]}]}'
    assert.equal(await run(ok), 0)
    assert.equal(await run('{"protection_rules":[{"type":"branch_policy"}]}'), 1)
    assert.equal(await run('{"protection_rules":[]}'), 1)
    assert.equal(await run('{"name":"live-db"}'), 1)
    assert.equal(await run('not json'), 1)
    assert.equal(await run(ok, 22), 1) // curl -f on HTTP 404/403
  } finally {
    await rm(bin, { recursive: true, force: true })
  }
})

test('apply: pinned CLI version, pinned actions, least privilege, safe concurrency, timeouts', () => {
  const t = apply()
  assert.match(t, /version: 2\.119\.0/)
  assert.doesNotMatch(t, /2\.102\.0/)
  assertAllPinned(t)
  assert.match(t, /^permissions:\s*\n\s+contents: read\s*$/m)
  assert.match(t, /^concurrency:[\s\S]*?group: live-migrations[\s\S]*?cancel-in-progress: false/m)
  for (const id of ['dry-run', 'apply']) {
    const b = jobBlock(t, id)
    assert.match(b, /timeout-minutes: \d+/)
    assert.match(b, /persist-credentials: false/)
  }
})
