#!/usr/bin/env node
// Local proof for PR #29 re-review item 1: the legal draft columns are not readable by the
// browser roles. Runs each check as its own psql session inside the shared local Clickit
// stack (`set role <role>`, then one SELECT), so Postgres itself answers with the same
// privilege check PostgREST relies on. Read-only: SELECTs only, nothing is written.
//
// LOCAL STACK ONLY. The container is pinned to supabase_db_Clickit; never the ALMAR stack,
// never live. Apply the migration first, under the heavy lock:
//
//   until mkdir /Users/koss/.clickit-heavy.lock 2>/dev/null; do sleep 20; done
//   echo $$ > /Users/koss/.clickit-heavy.lock/pid
//   supabase migration up --local && node scripts/db/legal-drafts-private.mjs
//   rm -rf /Users/koss/.clickit-heavy.lock
//
// Prints one line per check (never row data) and exits 0 only when every check passes.
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

export const CLICKIT_DB_CONTAINER = 'supabase_db_Clickit'
export const MIGRATION_VERSION = '20261021120000'

// The public query's column list (src/lib/queries.ts getLegalPageBySlug / getAllLegalPages).
const PUBLIC_SELECT = 'id, slug, title, content, title_ar, content_ar, ar_reviewed, updated_at'

/**
 * @typedef {{ name?: string, role: string, expect: 'allow' | 'deny', sql: string, expectOut?: string }} Check
 * @type {Check[]}
 */
export const CHECKS = [
  { name: 'migration recorded', role: 'postgres', expect: 'allow', expectOut: '1',
    sql: `select count(*) from supabase_migrations.schema_migrations where version = '${MIGRATION_VERSION}'` },
  { name: 'set_updated_at enabled', role: 'postgres', expect: 'allow', expectOut: 'O',
    sql: "select tgenabled from pg_trigger where tgname = 'set_updated_at' and tgrelid = 'public.legal_pages'::regclass" },
  ...['anon', 'authenticated'].flatMap((role) => [
    { role, expect: 'deny', sql: 'select title_ar_draft from public.legal_pages limit 1' },
    { role, expect: 'deny', sql: 'select content_ar_draft from public.legal_pages limit 1' },
    { role, expect: 'deny', sql: 'select * from public.legal_pages limit 1' },
    { role, expect: 'allow', sql: 'select title, content_ar, ar_reviewed from public.legal_pages limit 1' },
    { role, expect: 'allow', sql: `select ${PUBLIC_SELECT} from public.legal_pages order by sort_order limit 1` },
  ]),
  { role: 'service_role', expect: 'allow', sql: 'select title_ar_draft, content_ar_draft from public.legal_pages limit 1' },
]

/** Record separator for psql's unaligned output: legal page bodies contain newlines. */
export const RECORD_SEPARATOR = '\u001e'

/** docker exec arguments: one psql session, role switched, then the one query. */
export function psqlArgs(check) {
  return [
    'exec', CLICKIT_DB_CONTAINER, 'psql',
    '-U', 'postgres', '-d', 'postgres', '-X', '-q', '-At',
    '-R', RECORD_SEPARATOR,
    '-v', 'ON_ERROR_STOP=1',
    '-c', `set role ${check.role}`,
    '-c', check.sql,
  ]
}

const firstError = (stderr) =>
  String(stderr ?? '').split('\n').map((l) => l.trim()).find((l) => /^ERROR:/.test(l)) ?? String(stderr ?? '').trim().split('\n')[0] ?? ''

/**
 * @param {Check} check
 * @param {{ status: number | null, stdout: string, stderr: string }} res
 * @returns {{ ok: boolean, detail: string }}  detail never carries row data
 */
export function evaluate(check, res) {
  if (check.expect === 'deny') {
    if (res.status === 0) return { ok: false, detail: 'READ SUCCEEDED (expected permission denied)' }
    const err = firstError(res.stderr)
    return /permission denied/i.test(err)
      ? { ok: true, detail: err }
      : { ok: false, detail: `failed for another reason: ${err}` }
  }
  if (res.status !== 0) return { ok: false, detail: firstError(res.stderr) }
  if (check.expectOut !== undefined) {
    const out = String(res.stdout ?? '').split(RECORD_SEPARATOR).join('').trim()
    return out === check.expectOut
      ? { ok: true, detail: `returned ${out}` }
      : { ok: false, detail: `returned ${out.slice(0, 20)} (expected ${check.expectOut})` }
  }
  const rows = String(res.stdout ?? '').replace(/\n$/, '').split(RECORD_SEPARATOR).filter((r) => r !== '').length
  return { ok: true, detail: `read ok (${rows} row${rows === 1 ? '' : 's'})` }
}

function main() {
  let failed = 0
  for (const check of CHECKS) {
    const res = spawnSync('docker', psqlArgs(check), { encoding: 'utf8' })
    if (res.error) {
      console.error(`refused: could not run docker exec ${CLICKIT_DB_CONTAINER} (${res.error.message})`)
      return 2
    }
    const r = evaluate(check, res)
    if (!r.ok) failed += 1
    console.log(`${r.ok ? 'ok  ' : 'FAIL'} ${check.role.padEnd(13)} ${check.expect.padEnd(5)} ${check.sql} -> ${r.detail}`)
  }
  console.log(`legal-drafts-private: ${CHECKS.length - failed}/${CHECKS.length} checks passed`)
  return failed ? 1 : 0
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  process.exit(main())
}
