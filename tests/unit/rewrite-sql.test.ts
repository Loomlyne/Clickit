import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
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

const SCAN_PATTERN = String.raw`supabase\.co/storage/v1/|clickit-media\.[a-z0-9-]+\.workers\.dev`
const SUPABASE_RX = String.raw`https://lajguozmtissnnfccmej\.supabase\.co/storage/v1/object/public/(show-artwork|site-assets|avatars)/`
const WORKER_RX = String.raw`https://clickit-media\.clickitstory\.workers\.dev/(show-artwork|site-assets|avatars)/`
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
  assert.deepEqual(regexes, [SUPABASE_RX, WORKER_RX])
  const base = 'https://lajguozmtissnnfccmej.supabase.co/storage/v1'
  assert.equal(rewriteText(`${base}/object/public/show-artwork/a/b.webp?v=3`, regexes), 'https://media.clickitstory.ae/show-artwork/a/b.webp?v=3')
  assert.equal(rewriteText('https://clickit-media.clickitstory.workers.dev/site-assets/x.mp4', regexes), 'https://media.clickitstory.ae/site-assets/x.mp4')
  assert.equal(rewriteText(`${base}/object/public/avatars/u.png`, regexes), 'https://media.clickitstory.ae/avatars/u.png')
  for (const left of [
    'https://picsum.photos/seed/x/400/600',
    `${base}/object/public/other-bucket/x.png`,
    `${base}/render/image/public/show-artwork/x.png?width=200`,
    `${base}/object/sign/show-artwork/x.png?token=t`,
    'https://clickit-media.other.workers.dev/show-artwork/x.png',
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
  assert.doesNotMatch(stripComments(sql), /\binsert\b|\bupdate\b|^do\b/im, 'read-only')
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
