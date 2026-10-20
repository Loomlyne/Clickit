import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

import {
  classifyChanges,
  runGuard,
  scanSql,
} from '../../scripts/migration-guard.mjs'

const SCRIPT = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  'scripts',
  'migration-guard.mjs',
)
const DIR = 'supabase/migrations'
const GIT_ENV = {
  ...process.env,
  GIT_AUTHOR_NAME: 'Guard Test',
  GIT_AUTHOR_EMAIL: 'guard@example.test',
  GIT_COMMITTER_NAME: 'Guard Test',
  GIT_COMMITTER_EMAIL: 'guard@example.test',
}

function git(cwd: string, ...args: string[]) {
  return execFileSync('git', args, {
    cwd,
    env: GIT_ENV,
    encoding: 'utf8',
  }).trim()
}

async function put(repo: string, name: string, content: string) {
  const file = join(repo, DIR, name)
  await mkdir(dirname(file), { recursive: true })
  await writeFile(file, content)
}

async function commitAll(repo: string, message: string) {
  git(repo, 'add', '-A')
  git(repo, 'commit', '-q', '-m', message)
  return git(repo, 'rev-parse', 'HEAD')
}

/** Temp repo: base commit with two applied migrations, then `change` -> head. */
async function withRepo(
  change: (repo: string) => Promise<void> | void,
  check: (ctx: { repo: string; base: string; head: string }) => Promise<void> | void,
) {
  const repo = await mkdtemp(join(tmpdir(), 'mguard-'))
  try {
    git(repo, 'init', '-q', '-b', 'main')
    await put(repo, '20260101000000_a.sql', 'create table a (id int);\n')
    await put(repo, '20260102000000_b.sql', 'create table b (id int);\n')
    const base = await commitAll(repo, 'base')
    await change(repo)
    const head = await commitAll(repo, 'head')
    await check({ repo, base, head })
  } finally {
    await rm(repo, { recursive: true, force: true })
  }
}

function kinds(sql: string) {
  return scanSql(sql).findings.map((f) => f.kind)
}

test('fixture 1: plain create/alter add column pass', () => {
  assert.equal(scanSql('create table t (id int);').findings.length, 0)
  assert.equal(scanSql('alter table t add column x int;').findings.length, 0)
})

test('fixture 2: non-destructive delete/drop/trunc lookalikes pass', () => {
  const samples = [
    'create table c (t_id int references t(id) on delete cascade);',
    'create table c (t_id int references t(id) on delete set null);',
    'create policy p on t for delete using (true);',
    'grant select, delete on t to authenticated;',
    'alter table t add column deleted_at timestamptz;',
    'alter table t add column drop_cover_url text;',
    "select date_trunc('day', now());",
  ]
  for (const sql of samples) {
    assert.equal(scanSql(sql).findings.length, 0, sql)
  }
})

test('fixture 3: drop not null/default/identity/expression pass', () => {
  for (const form of ['not null', 'default', 'identity', 'expression']) {
    const sql = `alter table t alter column c drop ${form};`
    assert.equal(scanSql(sql).findings.length, 0, sql)
  }
})

test('fixture 4: drop forms are findings on the right line', () => {
  const stmts = [
    'DROP TABLE t;',
    'drop policy if exists p on t;',
    'alter table t drop column c;',
    'alter table t drop constraint k;',
  ]
  for (const stmt of stmts) {
    const { findings } = scanSql(`select 1;\n${stmt}\n`)
    assert.equal(findings.length, 1, stmt)
    assert.equal(findings[0].kind, 'drop')
    assert.equal(findings[0].line, 2)
    assert.equal(findings[0].text, stmt)
  }
})

test('fixture 5: same-line waiver passes and records the reason', () => {
  const stmts = [
    'DROP TABLE t;',
    'drop policy if exists p on t;',
    'alter table t drop column c;',
    'alter table t drop constraint k;',
  ]
  for (const stmt of stmts) {
    const result = scanSql(`${stmt} -- safe-drop: recreated below\n`)
    assert.equal(result.findings.length, 0, stmt)
    assert.equal(result.waived.length, 1, stmt)
    assert.equal(result.waived[0].reason, 'recreated below')
    assert.equal(result.waived[0].kind, 'drop')
    assert.equal(result.waived[0].line, 1)
  }
})

test('fixture 6: empty reason, other-line waiver and waiver in a string do not waive', () => {
  assert.deepEqual(kinds('drop table t; -- safe-drop:\n'), ['drop'])
  assert.deepEqual(kinds('drop table t; -- safe-drop:   \n'), ['drop'])
  assert.deepEqual(kinds('-- safe-drop: reason\ndrop table t;\n'), ['drop'])
  // the string text itself is scanned too (it contains the word drop), so
  // there may be two findings; the point is the real drop is not waived
  const inString = scanSql("select '-- safe-drop: x'; drop table t;\n")
  assert.ok(inString.findings.length >= 1)
  assert.equal(inString.waived.length, 0)
})

test('fixture 7: keywords inside comments are ignored; lines stay correct', () => {
  assert.equal(scanSql('-- drop table t\nselect 1;').findings.length, 0)
  assert.equal(scanSql('/* truncate t */ select 1;').findings.length, 0)
  assert.equal(
    scanSql('/* a /* delete from t */ b */ select 1;').findings.length,
    0,
  )
  const { findings } = scanSql('/* line1\nline2\nline3 */\ndrop table t;\n')
  assert.equal(findings.length, 1)
  assert.equal(findings[0].line, 4)
  // text after nested comment close is code again
  assert.deepEqual(kinds('/* a /* b */ drop table t */ select 1;'), [])
  assert.deepEqual(kinds('/* a /* b */ c */ drop table t;'), ['drop'])
})

test('fixture 8: truncate is a finding', () => {
  assert.deepEqual(kinds('truncate t;'), ['truncate'])
  assert.deepEqual(kinds('TRUNCATE TABLE t RESTART IDENTITY;'), ['truncate'])
})

test('fixture 9: delete as DML is a finding', () => {
  assert.deepEqual(kinds('delete from t'), ['delete-from'])
  const multi = scanSql('select 1;\ndelete\n from t;')
  assert.equal(multi.findings.length, 1)
  assert.equal(multi.findings[0].kind, 'delete-from')
  assert.equal(multi.findings[0].line, 2)
  assert.deepEqual(kinds('delete /* c */ from t'), ['delete-from'])
  assert.deepEqual(
    kinds('merge into t using s on (t.id = s.id) when matched then delete;'),
    ['then-delete'],
  )
})

test('fixture 10: string and dollar-quoted text is scanned', () => {
  assert.deepEqual(
    kinds(
      'create function f() returns void as $$ begin delete from t; end $$ language plpgsql;',
    ),
    ['delete-from'],
  )
  assert.deepEqual(
    kinds('create function g() returns void as $f$\nbegin\n  drop table t;\nend\n$f$ language plpgsql;'),
    ['drop'],
  )
  assert.deepEqual(kinds("execute 'drop table t';"), ['drop'])
  // comment markers inside a dollar body are still comments (code context)
  const body = scanSql('do $$ begin\n  -- drop table t\n  null;\nend $$;')
  assert.equal(body.findings.length, 0)
})

test('fixture 11: -- inside a string does not start a comment', () => {
  const { findings } = scanSql("select 'a--b'; drop table t;")
  assert.equal(findings.length, 1)
  assert.equal(findings[0].kind, 'drop')
  // escaped quote inside a string
  assert.deepEqual(kinds("select 'it''s -- not a comment'; drop table t;"), ['drop'])
  // E-string honours backslash escape
  assert.deepEqual(kinds("select E'it\\'s -- x'; drop table t;"), ['drop'])
  // double-quoted identifier containing --
  assert.deepEqual(kinds('select "a--b"; drop table t;'), ['drop'])
})

test('classifyChanges parses name-status -z output', () => {
  const out = classifyChanges('A\0x.sql\0M\0y.sql\0R100\0old.sql\0new.sql\0D\0z.sql\0')
  assert.deepEqual(out, [
    { status: 'A', path: 'x.sql' },
    { status: 'M', path: 'y.sql' },
    { status: 'R100', path: 'new.sql', oldPath: 'old.sql' },
    { status: 'D', path: 'z.sql' },
  ])
  assert.deepEqual(classifyChanges(''), [])
})

test('fixture 12: a clean new migration passes (CLI exit 0)', async () => {
  await withRepo(
    (repo) => put(repo, '20260103000000_c.sql', 'create table c (id int);\n'),
    ({ repo, base, head }) => {
      const result = runGuard({ cwd: repo, base, head })
      assert.deepEqual(result.violations, [])
      assert.deepEqual(result.warnings, [])
      const cli = spawnSync(
        process.execPath,
        [SCRIPT, '--base', base, '--head', head],
        { cwd: repo, encoding: 'utf8' },
      )
      assert.equal(cli.status, 0, cli.stdout + cli.stderr)
      assert.match(cli.stdout, /migration-guard: 1 files checked, 0 violations, 0 warnings/)
    },
  )
})

test('fixture 13: editing an applied migration fails (CLI exit 1)', async () => {
  await withRepo(
    (repo) => put(repo, '20260101000000_a.sql', 'create table a (id int, x int);\n'),
    ({ repo, base, head }) => {
      const { violations } = runGuard({ cwd: repo, base, head })
      assert.equal(violations.length, 1)
      assert.equal(violations[0].path, `${DIR}/20260101000000_a.sql`)
      assert.match(violations[0].reason, /applied migration modified/)
      const cli = spawnSync(
        process.execPath,
        [SCRIPT, '--base', base, '--head', head],
        { cwd: repo, encoding: 'utf8' },
      )
      assert.equal(cli.status, 1)
      assert.match(cli.stdout, /supabase\/migrations\/20260101000000_a\.sql: applied migration modified/)
    },
  )
})

test('fixture 14: renaming or deleting an applied migration fails', async () => {
  await withRepo(
    (repo) => {
      git(repo, 'mv', `${DIR}/20260102000000_b.sql`, `${DIR}/20260104000000_b.sql`)
    },
    ({ repo, base, head }) => {
      const { violations } = runGuard({ cwd: repo, base, head })
      assert.ok(violations.length >= 1)
      assert.ok(violations.some((v) => /renamed/.test(v.reason)))
    },
  )
  await withRepo(
    (repo) => {
      git(repo, 'rm', '-q', `${DIR}/20260101000000_a.sql`)
    },
    ({ repo, base, head }) => {
      const { violations } = runGuard({ cwd: repo, base, head })
      assert.equal(violations.length, 1)
      assert.match(violations[0].reason, /deleted/)
    },
  )
})

test('fixture 15: allow-list matches only exact from/to blobs', async () => {
  const path = `${DIR}/20260101000000_a.sql`
  await withRepo(
    (repo) => put(repo, '20260101000000_a.sql', '-- neutralised\nselect 1;\n'),
    ({ repo, base, head }) => {
      const from = git(repo, 'rev-parse', `${base}:${path}`)
      const to = git(repo, 'rev-parse', `${head}:${path}`)
      assert.deepEqual(
        runGuard({ cwd: repo, base, head, allowList: { [path]: { from, to } } }).violations,
        [],
      )
      // to = null never matches
      assert.equal(
        runGuard({ cwd: repo, base, head, allowList: { [path]: { from, to: null } } })
          .violations.length,
        1,
      )
      // different content than the allow-listed `to`
      assert.equal(
        runGuard({
          cwd: repo,
          base,
          head,
          allowList: { [path]: { from, to: '0'.repeat(40) } },
        }).violations.length,
        1,
      )
      // wrong `from`
      assert.equal(
        runGuard({ cwd: repo, base, head, allowList: { [path]: { from: '1'.repeat(40), to } } })
          .violations.length,
        1,
      )
    },
  )
  // second edit on top of the first: base blob now equals `to`
  const repo = await mkdtemp(join(tmpdir(), 'mguard-'))
  try {
    git(repo, 'init', '-q', '-b', 'main')
    await put(repo, '20260101000000_a.sql', 'create table a (id int);\n')
    const c0 = await commitAll(repo, 'applied')
    await put(repo, '20260101000000_a.sql', '-- neutralised\nselect 1;\n')
    const c1 = await commitAll(repo, 'neutralise')
    await put(repo, '20260101000000_a.sql', '-- neutralised\nselect 2;\n')
    const c2 = await commitAll(repo, 'second edit')
    const from = git(repo, 'rev-parse', `${c0}:${path}`)
    const to = git(repo, 'rev-parse', `${c1}:${path}`)
    const allowList = { [path]: { from, to } }
    assert.deepEqual(runGuard({ cwd: repo, base: c0, head: c1, allowList }).violations, [])
    assert.equal(runGuard({ cwd: repo, base: c1, head: c2, allowList }).violations.length, 1)
  } finally {
    await rm(repo, { recursive: true, force: true })
  }
})

test('fixture 16: bad file names fail', async () => {
  for (const [name, body] of [
    ['foo.sql', 'select 1;\n'],
    ['202601050000_x.sql', 'select 1;\n'],
    ['notes.txt', 'hello\n'],
  ]) {
    await withRepo(
      (repo) => put(repo, name, body),
      ({ repo, base, head }) => {
        const { violations } = runGuard({ cwd: repo, base, head })
        assert.equal(violations.length, 1, name)
        assert.match(violations[0].reason, /bad migration file name/)
      },
    )
  }
})

test('destructive SQL in an added migration fails with its line; waiver passes', async () => {
  await withRepo(
    (repo) => put(repo, '20260106000000_d.sql', 'drop table x;\n'),
    ({ repo, base, head }) => {
      const { violations } = runGuard({ cwd: repo, base, head })
      assert.equal(violations.length, 1)
      assert.equal(violations[0].line, 1)
      assert.equal(violations[0].path, `${DIR}/20260106000000_d.sql`)
      assert.match(violations[0].reason, /^drop without `-- safe-drop: <reason>`/)
    },
  )
  await withRepo(
    (repo) =>
      put(repo, '20260106000000_d.sql', 'drop table x; -- safe-drop: replaced by view\n'),
    ({ repo, base, head }) => {
      assert.deepEqual(runGuard({ cwd: repo, base, head }).violations, [])
    },
  )
})

test('an out-of-order version is a warning, not a violation', async () => {
  await withRepo(
    (repo) => put(repo, '20260101000001_late.sql', 'create table late (id int);\n'),
    ({ repo, base, head }) => {
      const result = runGuard({ cwd: repo, base, head })
      assert.deepEqual(result.violations, [])
      assert.equal(result.warnings.length, 1)
      assert.match(result.warnings[0].reason, /sorts before applied migrations/)
    },
  )
})

test('CLI exits 2 on a git error', async () => {
  await withRepo(
    (repo) => put(repo, '20260103000000_c.sql', 'select 1;\n'),
    ({ repo }) => {
      const cli = spawnSync(
        process.execPath,
        [SCRIPT, '--base', 'no-such-rev', '--head', 'HEAD'],
        { cwd: repo, encoding: 'utf8' },
      )
      assert.equal(cli.status, 2)
    },
  )
})
