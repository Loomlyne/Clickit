import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { scanSql } from '../../scripts/migration-guard.mjs'

// MEDIA-08 / MEDIA-02 (plan 03-05): lint the backup-table migration and the
// ops SQL the controller runs on live after Koss's word. Nothing here touches
// a database; the rolled-back proof is scripts/cutover/sql/test-local.sh.

const ROOT = process.cwd()
const MIG_DIR = join(ROOT, 'supabase/migrations')
const SQL_DIR = join(ROOT, 'scripts/cutover/sql')

const migrationNames = readdirSync(MIG_DIR).filter((f) => f.endsWith('.sql'))
const backupMigrations = migrationNames.filter((f) => /^\d{14}_media_url_rewrite_backup\.sql$/.test(f))
const opsFiles = readdirSync(SQL_DIR).filter((f) => f.endsWith('.sql')).sort()
const read = (dir: string, name: string) => readFileSync(join(dir, name), 'utf8')
const ops = (name: string) => read(SQL_DIR, name)
const migration = () => read(MIG_DIR, backupMigrations[0])
const stripComments = (sql: string) => sql.replace(/--[^\n]*/g, '')
const stripStrings = (sql: string) => sql.replace(/'(?:[^']|'')*'/g, "''")
/** The DO block of a file, from `do $tag$` to the closing `end $tag$;`. */
const doBlock = (sql: string, tag: string) => {
  const m = sql.match(new RegExp(`^do \\$${tag}\\$[\\s\\S]*?^end \\$${tag}\\$;`, 'm'))
  return m ? m[0] : null
}

const SCAN_PATTERN = String.raw`supabase\.co/storage/v1/|clickit-media(-r2)?\.[a-z0-9-]+\.workers\.dev`
const SUPABASE_RX = String.raw`https://lajguozmtissnnfccmej\.supabase\.co/storage/v1/object/public/(show-artwork|site-assets|avatars)/`
const WORKER_RX = String.raw`https://clickit-media\.clickitstory\.workers\.dev/(show-artwork|site-assets|avatars)/`
const WORKER_R2_RX = String.raw`https://clickit-media-r2\.clickitstory\.workers\.dev/(show-artwork|site-assets|avatars)/`
const REPLACEMENT = String.raw`https://media.clickitstory.ae/\1/`

const DRIVER: Array<[string, string]> = [
  ['app_config', 'hero_video_url'],
  ['app_config', 'hero_video_mobile_url'],
  ['app_config', 'og_image_url'],
  ['app_config', 'favicon_url'],
  ['app_config', 'favicon_dark_url'],
  ['app_config', 'auth_image_url'],
  ['app_config', 'preloader_video_url'],
  ['app_config', 'footer_content'],
  ['shows', 'hero_url'],
  ['shows', 'hero_image_mobile_url'],
  ['shows', 'card_image_url'],
  ['shows', 'poster_url'],
  ['shows', 'logo_url'],
  ['shows', 'hero_video_url'],
  ['shows', 'hero_video_mobile_url'],
  ['show_cast', 'image_url'],
  ['profiles', 'avatar_url'],
  ['shorts', 'thumbnail_url'],
]

const REQUIRED_OPS = [
  'check-backup-table.sql',
  'preflight.sql',
  'rewrite-media-urls.sql',
  'scan-old-hosts.sql',
  'report.sql',
  'reverse-media-urls.sql',
  'reverse-media-urls-partial.sql',
]

/** The four updated_at triggers on the driver tables (show_cast has none). */
const UPDATED_AT_TRIGGERS: Array<[string, string]> = [
  ['app_config', 'set_updated_at'],
  ['shows', 'set_updated_at'],
  ['profiles', 'set_updated_at'],
  ['shorts', 'shorts_updated_at'],
]

/** Every ('table','column',...) tuple in a VALUES driver list. */
const driverTuples = (sql: string) =>
  new Set([...sql.matchAll(/\('(\w+)'\s*,\s*'(\w+)'\s*,\s*'(?:text|jsonb)'\)/g)].map((m) => `${m[1]}.${m[2]}`))

/** Single-quoted SQL literals that hold one of the two rewrite host regexes. */
const hostRegexLiterals = (sql: string) =>
  [...sql.matchAll(/'([^']*\(show-artwork\|site-assets\|avatars\)\/)'/g)].map((m) => m[1])

/** Apply the rewrite as PostgreSQL does for a text column ('^' + regex, first match). */
const rewriteText = (value: string, regexes: string[]) =>
  regexes.reduce((v, rx) => v.replace(new RegExp(`^${rx}`), (_m, bucket) => `https://media.clickitstory.ae/${bucket}/`), value)

test('exactly one backup-table migration, newest version in supabase/migrations', () => {
  assert.equal(backupMigrations.length, 1, `found ${backupMigrations.join(', ') || 'none'}`)
  const version = backupMigrations[0].slice(0, 14)
  assert.ok(version > '20261021120000', 'version must sort after 20261021120000')
  for (const other of migrationNames) {
    if (other === backupMigrations[0]) continue
    if (/_phase\d+_/.test(other)) continue // later phases name their own migrations `_phaseN_` (Phase 5 M1a onward)
    assert.ok(other.slice(0, 14) < version, `${other} sorts after the backup migration`)
  }
})

test('migration creates only the private backup table with RLS on and grants revoked', () => {
  const sql = migration()
  assert.match(sql, /create table if not exists private\.media_url_rewrite_backup/)
  assert.match(sql, /enable row level security/)
  assert.ok(sql.includes('revoke all on table private.media_url_rewrite_backup from public, anon, authenticated'))
  assert.match(sql, /unique \(run_id, table_name, column_name, row_pk\)/)
  const body = stripComments(sql)
  assert.doesNotMatch(body, /\b(insert|update)\b/i, 'the data rewrite is not a migration')
  assert.equal([...body.matchAll(/create table/gi)].length, 1, 'one table only')
  assert.match(sql, /NOT a migration/)
  assert.match(sql, /scripts\/cutover\/sql/)
})

test('every required ops SQL file exists', () => {
  for (const name of REQUIRED_OPS) assert.ok(opsFiles.includes(name), `missing scripts/cutover/sql/${name}`)
})

test('scanSql: migration and every scripts/cutover/sql file are guard-clean', () => {
  const files: Array<[string, string]> = [
    [backupMigrations[0], migration()],
    ...opsFiles.map((name): [string, string] => [name, ops(name)]),
  ]
  for (const [name, sql] of files) {
    const result = scanSql(sql)
    assert.deepEqual(result.findings, [], `${name}: destructive SQL`)
    assert.deepEqual(result.unterminated, [], `${name}: unterminated quote or comment`)
    assert.deepEqual(result.waived, [], `${name}: no waivers expected`)
  }
})

test('no delete, drop or truncate word anywhere, and no RUN_ID_HERE placeholder', () => {
  for (const [name, sql] of [[backupMigrations[0], migration()], ...opsFiles.map((n) => [n, ops(n)])]) {
    assert.doesNotMatch(sql, /\bdelete\b|\bdrop\b|\btruncate\b/i, `${name}`)
    assert.ok(!sql.includes('RUN_ID_HERE'), `${name} still has RUN_ID_HERE`)
  }
})

test('rewrite names all 18 D-09 driver columns', () => {
  const tuples = driverTuples(ops('rewrite-media-urls.sql'))
  assert.equal(tuples.size, 18)
  for (const [t, c] of DRIVER) assert.ok(tuples.has(`${t}.${c}`), `rewrite misses ${t}.${c}`)
  assert.match(ops('rewrite-media-urls.sql'), /\('app_config'\s*,\s*'footer_content'\s*,\s*'jsonb'\)/)
})

test('rewrite: both host patterns, replacement, backup insert, guarded update, mismatch raises, run id set', () => {
  const sql = ops('rewrite-media-urls.sql')
  assert.ok(sql.includes(SUPABASE_RX), 'Supabase Storage pattern')
  assert.ok(sql.includes(WORKER_RX), 'media Worker pattern')
  assert.ok(sql.includes(WORKER_R2_RX), 'media-r2 Worker pattern (Phase 2 option A test host)')
  assert.ok(sql.includes(`'${REPLACEMENT}'`), 'replacement')
  assert.match(sql, /insert into private\.media_url_rewrite_backup/)
  assert.match(sql, /to_jsonb\(t\.%\d\$I\) = b\.old_value/)
  assert.match(sql, /raise exception 'rewrite mismatch/)
  assert.match(sql, /set_config\('clickit\.rewrite_run_id',\s*v_run::text,\s*true\)/)
  assert.match(sql, /^do \$rewrite\$/m)
  assert.equal([...stripComments(sql).matchAll(/^do \$/gm)].length, 1, 'one atomic DO block')
})

test('rewrite: jsonb structural check (strict $.** leaf count) raises on change', () => {
  const sql = ops('rewrite-media-urls.sql')
  assert.ok(sql.includes(`jsonb_path_query(b.old_value, 'strict $.**')`))
  assert.ok(sql.includes(`jsonb_path_query(b.new_value, 'strict $.**')`))
  assert.match(sql, /raise exception 'rewrite changed the jsonb structure/)
  assert.match(sql, /raise notice 'rewrite summary/)
})

test('rewrite regex semantics: ?v= kept, picsum, other bucket, render and sign paths untouched', () => {
  const regexes = hostRegexLiterals(ops('rewrite-media-urls.sql')).filter((rx) => rx.startsWith('https://'))
  assert.deepEqual(regexes, [SUPABASE_RX, WORKER_RX, WORKER_R2_RX])
  const base = 'https://lajguozmtissnnfccmej.supabase.co/storage/v1'
  assert.equal(rewriteText(`${base}/object/public/show-artwork/a/b.webp?v=3`, regexes), 'https://media.clickitstory.ae/show-artwork/a/b.webp?v=3')
  assert.equal(rewriteText('https://clickit-media.clickitstory.workers.dev/site-assets/x.mp4', regexes), 'https://media.clickitstory.ae/site-assets/x.mp4')
  assert.equal(rewriteText('https://clickit-media-r2.clickitstory.workers.dev/show-artwork/p/poster.webp?v=9', regexes), 'https://media.clickitstory.ae/show-artwork/p/poster.webp?v=9')
  assert.equal(rewriteText(`${base}/object/public/avatars/u.png`, regexes), 'https://media.clickitstory.ae/avatars/u.png')
  for (const left of [
    'https://picsum.photos/seed/x/400/600',
    `${base}/object/public/other-bucket/x.png`,
    `${base}/render/image/public/show-artwork/x.png?width=200`,
    `${base}/object/sign/show-artwork/x.png?token=t`,
    'https://clickit-media.other.workers.dev/show-artwork/x.png',
    'https://clickit-media-r2.other.workers.dev/show-artwork/x.png',
    'https://clickit-media-r2.clickitstory.workers.dev/other-bucket/x.png',
    'https://clickit-media-r3.clickitstory.workers.dev/show-artwork/x.png',
    `see ${base}/object/public/show-artwork/x.png`,
  ]) {
    assert.equal(rewriteText(left, regexes), left)
  }
})

test('scan-old-hosts: exact narrowed pattern, public + auth, all text-like types, admin_audit_log excluded', () => {
  const sql = ops('scan-old-hosts.sql')
  assert.ok(sql.includes(`'${SCAN_PATTERN}'`))
  assert.match(sql, /table_schema in \('public', 'auth'\)/)
  assert.match(sql, /data_type in \('text', 'character varying', 'jsonb', 'json', 'ARRAY'\)/)
  assert.match(sql, /'BASE TABLE'/)
  assert.match(sql, /table_name = 'admin_audit_log'/)
  assert.match(sql, /not \(c\.table_schema = 'public' and c\.table_name = 'admin_audit_log'\)/)
  assert.doesNotMatch(sql, /workers\\\.dev\|/, 'no bare workers.dev alternative')
  assert.doesNotMatch(stripComments(sql), /\binsert\b|\bupdate\b/i, 'read-only')
})

test('scan pattern semantics: media hosts match, other workers.dev values and a bare ref do not', () => {
  const rx = new RegExp(SCAN_PATTERN, 'i')
  assert.ok(rx.test('https://lajguozmtissnnfccmej.supabase.co/storage/v1/object/public/show-artwork/a.png'))
  assert.ok(rx.test('https://lajguozmtissnnfccmej.supabase.co/storage/v1/render/image/public/x.png'))
  assert.ok(rx.test('https://clickit-media.clickitstory.workers.dev/x'))
  assert.ok(rx.test('https://clickit-media.other-sub.workers.dev/x'))
  assert.ok(rx.test('https://clickit-media-r2.clickitstory.workers.dev/show-artwork/x.png'))
  assert.ok(rx.test('https://clickit-media-r2.other-sub.workers.dev/x'))
  assert.ok(!rx.test('https://some-app.someone.workers.dev/x'))
  assert.ok(!rx.test('lajguozmtissnnfccmej'))
  assert.ok(!rx.test('https://lajguozmtissnnfccmej.supabase.co/auth/v1/callback'))
})

test('preflight: role and version reads, all driver columns, not-rewritable count, outside-driver scan', () => {
  const sql = ops('preflight.sql')
  assert.match(sql, /select current_user, rolsuper, rolbypassrls from pg_roles where rolname = current_user/)
  assert.match(sql, /select version\(\)/)
  const tuples = driverTuples(sql)
  for (const [t, c] of DRIVER) assert.ok(tuples.has(`${t}.${c}`), `preflight misses ${t}.${c}`)
  assert.match(sql, /not_rewritable/)
  assert.match(sql, /not rewritable/)
  assert.match(sql, /stop: plan revision/)
  assert.ok(sql.includes(`'${SCAN_PATTERN}'`))
  assert.match(sql, /-- \[not-rewritable:begin\][\s\S]+-- \[not-rewritable:end\]/)
  assert.match(sql, /-- \[outside-driver:begin\][\s\S]+-- \[outside-driver:end\]/)
  assert.match(sql, /'admin_audit_log'/)
  assert.doesNotMatch(stripStrings(stripComments(sql)), /\binsert\b|\bupdate\b|^do\b/im, 'read-only')
})

test('preflight and rewrite use the same host regexes and replacement', () => {
  const rewrite = hostRegexLiterals(ops('rewrite-media-urls.sql')).filter((rx) => rx.startsWith('https://'))
  const preflight = hostRegexLiterals(ops('preflight.sql')).filter((rx) => rx.startsWith('https://'))
  assert.deepEqual([...new Set(preflight)], rewrite)
  assert.ok(ops('preflight.sql').includes(`'${REPLACEMENT}'`))
})

test('report: newest run per table/column, picsum posters by id and slug, admin_audit_log old-host rows', () => {
  const sql = ops('report.sql')
  assert.match(sql, /private\.media_url_rewrite_backup/)
  assert.match(sql, /order by max\(created_at\) desc/)
  assert.match(sql, /group by b\.run_id, table_name, column_name/)
  assert.match(sql, /picsum\\\.photos/)
  assert.match(sql, /s\.id, s\.slug, s\.poster_url/)
  assert.match(sql, /public\.admin_audit_log/)
  assert.ok(sql.includes(`'${SCAN_PATTERN}'`))
  assert.doesNotMatch(stripComments(sql), /\binsert\b|\bupdate\b/i, 'read-only')
})

test('reverse: run id from the setting or the single open run, raises on several, UPDATE only, restored_at set', () => {
  const sql = ops('reverse-media-urls.sql')
  assert.match(sql, /current_setting\('clickit\.rewrite_run_id', true\)/)
  assert.match(sql, /restored_at is null/)
  assert.match(sql, /raise exception 'reverse: % open runs/)
  assert.match(sql, /set restored_at = now\(\)/)
  assert.match(sql, /to_jsonb\(t\.%I\) = %L::jsonb/)
  assert.doesNotMatch(stripComments(sql), /\binsert\b/i)
  assert.match(sql, /^do \$reverse\$/m)
})

test('check-backup-table: existence, RLS flag, row count, no anon/authenticated access', () => {
  const sql = ops('check-backup-table.sql')
  assert.match(sql, /to_regclass\('private\.media_url_rewrite_backup'\)/)
  assert.match(sql, /relrowsecurity/)
  assert.match(sql, /count\(\*\)/)
  assert.match(sql, /has_table_privilege\('anon', 'private\.media_url_rewrite_backup', 'select'\)/)
  assert.match(sql, /has_table_privilege\('authenticated', 'private\.media_url_rewrite_backup', 'select'\)/)
  assert.match(sql, /aclexplode\(c\.relacl\)/)
  assert.doesNotMatch(stripComments(sql), /\binsert\b|\bupdate\b/i, 'read-only')
})

test('with-heavy-lock.sh and test-local.sh parse, and a log path inside the repo is refused before the lock', () => {
  for (const script of ['scripts/cutover/with-heavy-lock.sh', 'scripts/cutover/sql/test-local.sh']) {
    const syntax = spawnSync('bash', ['-n', join(ROOT, script)], { encoding: 'utf8' })
    assert.equal(syntax.status, 0, `${script}: ${syntax.stderr}`)
  }
  const refused = spawnSync(join(ROOT, 'scripts/cutover/with-heavy-lock.sh'), ['./x.log', '--', 'true'], {
    cwd: ROOT,
    encoding: 'utf8',
  })
  assert.equal(refused.status, 64)
  assert.match(refused.stderr, /refusing log path inside the repository/)
  const lock = readFileSync(join(ROOT, 'scripts/cutover/with-heavy-lock.sh'), 'utf8')
  assert.ok(lock.includes('LOCK=/Users/koss/.clickit-heavy.lock'))
  assert.match(lock, /echo "exit=\$status" >>"\$LOG_ABS"/)
  assert.match(lock, /trap release EXIT/)
})

test('test-local.sql: one transaction that ends in rollback, every ops file included', () => {
  const sql = ops('test-local.sql')
  assert.match(sql, /^begin;$/m)
  assert.match(sql, /^rollback;$/m)
  assert.doesNotMatch(stripComments(sql), /^commit\b/im)
  for (const name of REQUIRED_OPS) assert.ok(sql.includes(`\\ir ${name}`), `test-local.sql does not run ${name}`)
  assert.ok(sql.includes('\\ir migration_media_url_rewrite_backup.sql'))
  assert.ok(sql.includes("raise notice 'test-local: PASS'"))
  assert.ok(sql.includes("'local stack is missing seed rows (no shows rows): seed the fixture rows with migration up --local / the seed script; never db reset the shared stack'"))
  assert.doesNotMatch(sql, /run supabase db reset/, 'never tell anyone to reset the shared stack')
})

// PR #31 review findings 1, 2, 6, 7 (2026-10-21).

test('migration: backup rows can be marked skipped by a partial reverse', () => {
  const sql = migration()
  assert.match(sql, /^\s+reverse_skipped_at timestamptz,$/m)
  assert.match(sql, /^\s+reverse_skip_reason text,?$/m)
})

test('reverse: strict file and partial file share one DO block and differ only in the mode they set', () => {
  const strict = ops('reverse-media-urls.sql')
  const partial = ops('reverse-media-urls-partial.sql')
  assert.match(strict, /^select set_config\('clickit\.reverse_mode', 'strict', false\)/m)
  assert.match(partial, /^select set_config\('clickit\.reverse_mode', 'partial', false\)/m)
  const a = doBlock(strict, 'reverse')
  const b = doBlock(partial, 'reverse')
  assert.ok(a, 'reverse-media-urls.sql has a do $reverse$ block')
  assert.equal(b, a, 'the partial file must carry the same DO block as reverse-media-urls.sql')
  for (const sql of [strict, partial]) {
    assert.equal([...stripComments(sql).matchAll(/^do \$/gm)].length, 1, 'one atomic DO block')
    assert.doesNotMatch(stripComments(sql), /\binsert\b/i)
  }
})

test('reverse: strict refuses and lists every changed value; partial restores the rest and marks the skipped rows', () => {
  const block = doBlock(ops('reverse-media-urls.sql'), 'reverse') ?? ''
  assert.match(block, /coalesce\(nullif\(current_setting\('clickit\.reverse_mode', true\), ''\), 'strict'\)/)
  assert.match(block, /raise exception 'reverse: clickit\.reverse_mode must be strict or partial/)
  assert.match(block, /raise exception 'reverse \(strict\): % value\(s\) changed since the rewrite, nothing restored/)
  assert.match(block, /'row missing'/)
  assert.match(block, /'value changed since the rewrite'/)
  assert.match(block, /set reverse_skipped_at = now\(\), reverse_skip_reason = v_reason/)
  assert.match(block, /set restored_at = now\(\), reverse_skipped_at = null, reverse_skip_reason = null/)
  assert.match(block, /raise notice 'reverse \(%\): run_id % restored % value\(s\), skipped %/)
  assert.doesNotMatch(block, /v_one <> 1 then\s+raise exception/, 'no all-or-nothing raise on the first changed row')
})

test('rewrite and reverse pause exactly the four updated_at triggers inside their own transaction', () => {
  for (const [name, tag] of [['rewrite-media-urls.sql', 'rewrite'], ['reverse-media-urls.sql', 'reverse']] as const) {
    const block = doBlock(ops(name), tag) ?? ''
    for (const [t, g] of UPDATED_AT_TRIGGERS) {
      assert.ok(block.includes(`('${t}', '${g}')`), `${name}: trigger ${t}.${g} not in the pause list`)
    }
    assert.match(block, /tgenabled = 'O'/, `${name}: checks each trigger is enabled before pausing it`)
    assert.match(block, /'alter table public\.%I disable trigger %I'/, `${name}: disable`)
    assert.match(block, /'alter table public\.%I enable trigger %I'/, `${name}: re-enable`)
    assert.ok(block.indexOf('disable trigger') < block.lastIndexOf('enable trigger'), `${name}: re-enabled after the writes`)
    assert.match(block, /set_config\('lock_timeout', '10s', true\)/, `${name}: bounded lock wait`)
    assert.doesNotMatch(block, /session_replication_role/, `${name}: no session_replication_role`)
  }
})

test('preflight: role privileges on private and the driver tables, trigger list, each with a verdict', () => {
  const sql = ops('preflight.sql')
  assert.match(sql, /-- \[role:begin\][\s\S]+-- \[role:end\]/)
  assert.match(sql, /-- \[triggers:begin\][\s\S]+-- \[triggers:end\]/)
  assert.match(sql, /has_schema_privilege\(current_user, n\.oid, 'USAGE'\)/)
  for (const priv of ['SELECT', 'INSERT', 'UPDATE']) {
    assert.ok(sql.includes(`has_table_privilege(current_user, to_regclass('private.media_url_rewrite_backup'), '${priv}')`), `backup ${priv}`)
  }
  assert.match(sql, /pg_has_role\(current_user, c\.relowner, 'USAGE'\)/)
  assert.match(sql, /'stop: role cannot run the rewrite'/)
  for (const [t, g] of UPDATED_AT_TRIGGERS) assert.ok(sql.includes(`('${t}', '${g}')`), `preflight trigger ${t}.${g}`)
})

test('preflight triggers: the four updated_at triggers must exist and be enabled; any other trigger is listed, not a stop', () => {
  const sql = ops('preflight.sql')
  const block = sql.match(/-- \[triggers:begin\]([\s\S]+)-- \[triggers:end\]/)?.[1] ?? ''
  assert.match(block, /full join found f on f\.tbl = e\.tbl and f\.trg = e\.trg/, 'a missing updated_at trigger still shows as a row')
  assert.match(block, /tgfoid::regprocedure::text as function_name/, 'other triggers are listed with their function')
  assert.match(block, /when e\.trg is null then 'listed: other trigger, read it against the driver columns before Step 49'/)
  assert.match(block, /'stop: updated_at trigger missing'/)
  assert.match(block, /'stop: updated_at trigger not enabled'/)
  assert.doesNotMatch(block, /'stop: plan revision'/, 'an extra trigger is no longer a stop by itself')
})

test('report and check-backup-table count skipped rows; report lists them with the reason', () => {
  assert.match(ops('report.sql'), /count\(b\.reverse_skipped_at\) as skipped/)
  assert.match(ops('report.sql'), /reverse_skip_reason/)
  assert.match(ops('check-backup-table.sql'), /count\(\*\) filter \(where reverse_skipped_at is not null\) as skipped_rows/)
})

test('test-local.sql: updated_at drift, concurrent edit, strict refusal and partial reverse are asserted', () => {
  const sql = ops('test-local.sql')
  assert.match(sql, /updated_at = '2001-02-03 04:05:06\+00'/)
  assert.ok(sql.includes("raise notice 'test-local: updated_at unchanged after rewrite"))
  assert.ok(sql.includes("raise notice 'test-local: concurrent edit refused ok"))
  assert.ok(sql.includes("raise notice 'test-local: strict reverse refused ok"))
  assert.ok(sql.includes("raise notice 'test-local: partial reverse ok"))
  assert.match(sql, /^savepoint concurrent_edit;$/m)
  assert.match(sql, /create trigger test_local_noop before update on public\.shows/)
  assert.ok(sql.includes("raise notice 'test-local: other trigger listed"))
  // the other-trigger list must CONTAIN the planted no-op (extra triggers from
  // other branches on the shared stack are allowed), never an updated_at one
  assert.ok(sql.includes(String.raw`v_trg_listed !~ '(^|,)shows\.test_local_noop=test_local_noop\(\)(,|$)'`))
  assert.ok(sql.includes(String.raw`v_trg_listed ~ '(^|,)(app_config\.set_updated_at|shows\.set_updated_at|profiles\.set_updated_at|shorts\.shorts_updated_at)='`))
  assert.doesNotMatch(sql, /v_trg_listed is distinct from/, 'no exact-equality on the other-trigger list')
  assert.match(sql, /^rollback to savepoint concurrent_edit;$/m)
  assert.ok(sql.indexOf("raise notice 'test-local: PASS'") > sql.indexOf("raise notice 'test-local: partial reverse ok"), 'PASS comes last')
})

test('no script under scripts/cutover/sql disables ALL or USER triggers (only the four named updated_at triggers are paused)', () => {
  for (const name of readdirSync(SQL_DIR)) {
    const text = read(SQL_DIR, name)
    assert.doesNotMatch(text, /disable\s+trigger\s+(all|user)\b/i, `${name} disables all/user triggers`)
    assert.doesNotMatch(text, /session_replication_role/i, `${name} touches session_replication_role`)
  }
  for (const [name, tag] of [['rewrite-media-urls.sql', 'rewrite'], ['reverse-media-urls.sql', 'reverse'], ['reverse-media-urls-partial.sql', 'reverse']] as const) {
    const block = doBlock(ops(name), tag) ?? ''
    // the pause list is the only VALUES list of trigger names in the block, and it holds exactly the four
    const pairs = [...block.matchAll(/\('(\w+)', '(\w+_updated_at|set_updated_at)'\)/g)].map((m) => `${m[1]}.${m[2]}`)
    assert.deepEqual([...new Set(pairs)].sort(), UPDATED_AT_TRIGGERS.map(([t, g]) => `${t}.${g}`).sort(), `${name}: pause list`)
    assert.equal([...block.matchAll(/disable trigger/g)].length, 1, `${name}: one disable statement (inside the loop over the four)`)
  }
})

test('test-local.sql: a counting trigger proves other triggers still fire during the rewrite and the reverse', () => {
  const sql = ops('test-local.sql')
  assert.match(sql, /create temp table noop_fires/)
  assert.match(sql, /insert into noop_fires default values;/)
  assert.ok(sql.includes("raise notice 'test-local: other trigger fired during the rewrite"))
  assert.ok(sql.includes("raise notice 'test-local: other trigger fired during the reverse"))
  assert.ok(sql.includes('the pause was not rolled back'))
})
