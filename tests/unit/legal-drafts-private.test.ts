// PR #29 re-review item 1: the legal draft columns are not readable by anon or authenticated.
// scripts/db/legal-drafts-private.mjs proves it on the shared local stack (real Postgres
// privileges, `set role`); these tests pin what it checks and how it reads psql's answer, so
// a later edit cannot quietly drop a check.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import {
  CHECKS,
  CLICKIT_DB_CONTAINER,
  MIGRATION_VERSION,
  RECORD_SEPARATOR,
  evaluate,
  psqlArgs,
} from '../../scripts/db/legal-drafts-private.mjs'

const find = (role: string, expect: string, sql: RegExp) =>
  CHECKS.find((c: { role: string; expect: string; sql: string }) => c.role === role && c.expect === expect && sql.test(c.sql))

test('only the Clickit stack: the container is pinned', () => {
  assert.equal(CLICKIT_DB_CONTAINER, 'supabase_db_Clickit')
  const args = psqlArgs({ role: 'anon', sql: 'select 1' })
  assert.deepEqual(args.slice(0, 3), ['exec', CLICKIT_DB_CONTAINER, 'psql'])
  assert.ok(args.includes('ON_ERROR_STOP=1'))
  // Rows are split on a record separator, not newlines (legal bodies are multi-line).
  assert.equal(args[args.indexOf('-R') + 1], RECORD_SEPARATOR)
  // The role is switched in the same session as the query.
  assert.ok(args.includes('set role anon'))
  assert.equal(args.at(-1), 'select 1')
})

test('anon and authenticated are refused each draft column and select *', () => {
  for (const role of ['anon', 'authenticated']) {
    assert.ok(find(role, 'deny', /^select title_ar_draft from public\.legal_pages/), `${role} title_ar_draft`)
    assert.ok(find(role, 'deny', /^select content_ar_draft from public\.legal_pages/), `${role} content_ar_draft`)
    assert.ok(find(role, 'deny', /^select \* from public\.legal_pages/), `${role} select *`)
    const pub = find(role, 'allow', /^select title, content_ar, ar_reviewed from public\.legal_pages/)
    assert.ok(pub, `${role} reads the public columns`)
  }
  // The public query's own column list works for anon.
  const q = readFileSync('src/lib/queries.ts', 'utf8')
  const cols = /from\('legal_pages'\)\s*\.select\('([^']*)'\)/.exec(q)![1]
  assert.ok(CHECKS.some((c: { role: string; expect: string; sql: string }) => c.role === 'anon' && c.expect === 'allow' && c.sql.includes(cols)))
})

test('service_role still reads the drafts; the migration is recorded and the trigger is back on', () => {
  assert.ok(find('service_role', 'allow', /title_ar_draft, content_ar_draft/))
  const recorded = CHECKS.find((c: { name: string }) => c.name === 'migration recorded')
  assert.ok(recorded && recorded.sql.includes(MIGRATION_VERSION) && recorded.expectOut === '1')
  assert.equal(MIGRATION_VERSION, '20261021120000')
  const trigger = CHECKS.find((c: { name: string }) => c.name === 'set_updated_at enabled')
  assert.ok(trigger && trigger.expectOut === 'O')
})

test('evaluate: deny passes only on permission denied; allow needs exit 0 (and the expected output)', () => {
  const deny = { role: 'anon', expect: 'deny', sql: 'select title_ar_draft from public.legal_pages' }
  assert.equal(evaluate(deny, { status: 1, stdout: '', stderr: 'ERROR:  permission denied for table legal_pages' }).ok, true)
  assert.equal(evaluate(deny, { status: 0, stdout: 'مسودة', stderr: '' }).ok, false, 'a read is a failure')
  assert.equal(evaluate(deny, { status: 1, stdout: '', stderr: 'ERROR:  column "title_ar_draft" does not exist' }).ok, false, 'a missing column proves nothing')
  assert.equal(evaluate(deny, { status: 2, stdout: '', stderr: 'could not connect' }).ok, false)
  const allow = { role: 'anon', expect: 'allow', sql: 'select title from public.legal_pages' }
  assert.equal(evaluate(allow, { status: 0, stdout: 'Terms of Use', stderr: '' }).ok, true)
  const multiLine = evaluate(allow, { status: 0, stdout: `Terms\nline 2\nline 3${RECORD_SEPARATOR}Privacy\nline 2\n`, stderr: '' })
  assert.equal(multiLine.detail, 'read ok (2 rows)')
  assert.equal(evaluate(allow, { status: 1, stdout: '', stderr: 'ERROR:  permission denied for table legal_pages' }).ok, false)
  const exact = { role: 'postgres', expect: 'allow', sql: 'select 1', expectOut: 'O' }
  assert.equal(evaluate(exact, { status: 0, stdout: 'O\n', stderr: '' }).ok, true)
  assert.equal(evaluate(exact, { status: 0, stdout: 'D\n', stderr: '' }).ok, false)
})

test('evaluate never echoes row data, only the psql error line', () => {
  const allow = { role: 'service_role', expect: 'allow', sql: 'select title_ar_draft, content_ar_draft from public.legal_pages' }
  const r = evaluate(allow, { status: 0, stdout: 'secret draft text', stderr: '' })
  assert.ok(!r.detail.includes('secret draft text'))
})
