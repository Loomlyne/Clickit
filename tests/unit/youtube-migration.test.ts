// Text-level checks for Phase 6 migration 1 (expand, D-21): new episode
// columns, the catalog-wide youtube_video_id index, renumber_season,
// record_youtube_checks and the Vault key functions (D-20). The file is
// reviewed SQL that only runs on live after an approved dry-run (06-21), so
// these checks lock its safety properties before any database sees it.
import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

import { scanSql } from '../../scripts/migration-guard.mjs'

const DIR = fileURLToPath(new URL('../../supabase/migrations/', import.meta.url))
const SUFFIX = '_youtube_episode_status_and_order.sql'
// Last migration on main before Phase 6. Files sorting after it are "new".
const PRE_PHASE6_LAST = '20260810120000_broadcast_day_array.sql'

const files = readdirSync(DIR)
  .filter((f) => f.endsWith('.sql'))
  .sort()
const matches = files.filter((f) => f.endsWith(SUFFIX))
const FILE = matches[0] ?? ''
const sql = FILE ? readFileSync(DIR + FILE, 'utf8') : ''

// Remove `--` comments (outside string literals is close enough here: the
// file has no `--` inside a string) so body scans see only code.
function stripComments(text: string): string {
  return text
    .split('\n')
    .map((line) => line.replace(/--.*$/, ''))
    .join('\n')
}

const code = stripComments(sql)

// Body of one `create or replace function <name>(` ... `$$;` block.
function fnBlock(name: string): string {
  const start = code.indexOf(`create or replace function ${name}(`)
  assert.ok(start > -1, `missing function ${name}`)
  const end = code.indexOf('$$;', start)
  assert.ok(end > start, `unterminated function ${name}`)
  return code.slice(start, end + 3)
}

function escape(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function assertServiceRoleOnly(signature: string): void {
  const sig = escape(signature)
  assert.match(
    code,
    new RegExp(
      `revoke all on function ${sig}\\s+from public, anon, authenticated;`
    ),
    `revoke missing for ${signature}`
  )
  assert.match(
    code,
    new RegExp(`grant execute on function ${sig} to service_role;`),
    `grant missing for ${signature}`
  )
}

test('exactly one expand migration exists and it sorts last (bar later phases)', () => {
  assert.equal(matches.length, 1)
  assert.ok(FILE > PRE_PHASE6_LAST, 'sorts after every pre-Phase 6 migration')
  // Only a later phase's own migration may sort after it: Phase 2 legal pages Arabic review (PR #29)
  // and the Phase 3 MEDIA-08 backup table (plan 03-05).
  assert.deepEqual(
    files.filter((f) => f > FILE),
    ['20261021120000_legal_pages_arabic_review.sql', '20261021143410_media_url_rewrite_backup.sql']
  )
  assert.match(FILE, /^\d{14}_youtube_episode_status_and_order\.sql$/)
})

test('five nullable check columns with their constraints, no backfill', () => {
  const episodeAdds = code.slice(code.indexOf('alter table public.episodes'), code.indexOf(';', code.indexOf('alter table public.episodes')))
  assert.equal((episodeAdds.match(/add column if not exists/g) ?? []).length, 5)
  assert.match(
    code,
    /add column if not exists youtube_status text\s+check \(youtube_status in \('ok', ?'private', ?'removed', ?'not_embeddable', ?'blocked_ae', ?'not_ready'\)\)/
  )
  assert.match(code, /add column if not exists youtube_checked_at timestamptz/)
  assert.match(
    code,
    /add column if not exists youtube_duration_seconds integer\s+check \(youtube_duration_seconds >= 0\)/
  )
  assert.match(
    code,
    /add column if not exists player_error_code integer\s+check \(player_error_code in \(2, ?5, ?100, ?101, ?150\)\)/
  )
  assert.match(code, /add column if not exists player_error_at timestamptz/)
  assert.doesNotMatch(code, /needs_english/i)
  // No statement-level update of existing rows outside function bodies.
  const outside = code.replace(/\$\$[\s\S]*?\$\$/g, '')
  assert.doesNotMatch(outside, /\bupdate\s+public\./i)
})

test('edited flags (review item 7): boolean not null default false, only for admin-editable fields', () => {
  const adds = code.match(/add column if not exists/g) ?? []
  assert.equal(adds.length, 13)
  const flags = [...code.matchAll(/add column if not exists (\w+_edited) boolean not null default false/g)].map((m) => m[1])
  assert.deepEqual(flags, [
    'title_edited',
    'title_ar_edited',
    'description_edited',
    'description_ar_edited',
    'title_edited',
    'channel_name_edited',
  ])
  // Every "not null default" in the file is one of these six flags.
  assert.equal((code.match(/not null default/g) ?? []).length, 6)
  assert.doesNotMatch(code, /not null default true/)
  // The shorts form has no thumbnail field: no flag, always refreshed.
  assert.doesNotMatch(code, /thumbnail_edited/)
  const shortsAlter = code.slice(code.indexOf('alter table public.shorts'), code.indexOf(';', code.indexOf('alter table public.shorts')))
  assert.match(shortsAlter, /add column if not exists title_edited boolean not null default false/)
  assert.match(shortsAlter, /add column if not exists channel_name_edited boolean not null default false/)
  assert.match(shortsAlter, /add column if not exists youtube_checked_at timestamptz/)
  // Episodes' text baseline marker (PR #27 re-review, note 1): nullable, no
  // default, in the flags' alter statement.
  const flagsAlterStart = code.lastIndexOf(
    'alter table public.episodes',
    code.indexOf('add column if not exists title_edited')
  )
  const flagsAlter = code.slice(flagsAlterStart, code.indexOf(';', flagsAlterStart))
  assert.match(flagsAlter, /add column if not exists youtube_text_baseline_at timestamptz$/)
  assert.equal((code.match(/add column if not exists youtube_text_baseline_at/g) ?? []).length, 1)
  // Flags are never granted to viewer roles and never added to episodes_view.
  assert.doesNotMatch(code, /episodes_view/)
})
test('duplicate guard raises before the catalog-wide unique index', () => {
  const guard = code.indexOf('having count(*) > 1')
  const index = code.indexOf(
    'create unique index if not exists episodes_youtube_video_id_key'
  )
  assert.ok(guard > -1, 'duplicate guard missing')
  assert.ok(index > guard, 'unique index must come after the guard')
  assert.match(code, /errcode = '23505'/)
  assert.match(
    code,
    /create unique index if not exists episodes_youtube_video_id_key\s+on public\.episodes \(youtube_video_id\)\s+where youtube_video_id is not null and youtube_video_id <> '';/
  )
  // Covers archived rows too (Pitfall 7): no archived filter on the index.
  const indexStmt = code.slice(index, code.indexOf(';', index))
  assert.doesNotMatch(indexStmt, /archived/)
})

test('renumber_season: invoker, fixed search_path, shared advisory lock', () => {
  const fn = fnBlock('public.renumber_season')
  assert.match(
    fn,
    /returns table \(\s*episode_id uuid,\s*old_number integer,\s*new_number integer\s*\)/
  )
  assert.match(fn, /language plpgsql/)
  assert.match(fn, /security invoker/)
  assert.doesNotMatch(fn, /security definer/)
  assert.match(fn, /set search_path = pg_catalog, public/)
  assert.match(
    fn,
    /pg_advisory_xact_lock\(\s*hashtextextended\(p_season_id::text, 3071971\)\s*\)/
  )
  assert.match(fn, /errcode = 'P0002',\s*message = 'Season not found'/)
  assert.match(fn, /errcode = 'P0002',\s*message = 'Season has no episodes'/)
  assert.match(fn, /errcode = 'P0001',\s*message = 'Already numbered 1 to N'/)
  assert.match(fn, /for update/)
  assert.match(fn, /episode_number = \(?e\.episode_number \+ v_off\)?/)
  assert.match(
    fn,
    /row_number\(\) over \(order by x\.archived, x\.episode_number\)/
  )
  // The season lookup comes before the lock, the lock before the row lock.
  const lookup = fn.indexOf('Season not found')
  const lock = fn.indexOf('pg_advisory_xact_lock')
  const rowLock = fn.indexOf('for update')
  assert.ok(lookup > -1 && lookup < lock && lock < rowLock)
  assertServiceRoleOnly('public.renumber_season(uuid)')
})

test('the comment does not claim imports take the advisory lock; it names the constraint they rely on', () => {
  assert.doesNotMatch(sql, /renumber and import commits serialise/)
  assert.match(sql, /-- and renumber serialise per season\. Imports do not take this lock/)
  assert.match(sql, /episodes_season_id_episode_number_key/)
})

test('episodes_season_id_episode_number_key is the default name of the create_schema unique and is never renamed', () => {
  const schema = readFileSync(DIR + '20260401000000_create_schema.sql', 'utf8')
  const table = schema.slice(
    schema.indexOf('create table if not exists public.episodes'),
    schema.indexOf(');', schema.indexOf('create table if not exists public.episodes'))
  )
  // An unnamed table constraint: Postgres names it <table>_<cols>_key.
  assert.match(table, /\n  unique \(season_id, episode_number\)/)
  for (const f of files) {
    const text = stripComments(readFileSync(DIR + f, 'utf8'))
    assert.doesNotMatch(text, /rename constraint episodes_season_id_episode_number_key/i, f)
    assert.doesNotMatch(text, /drop constraint (if exists )?episodes_season_id_episode_number_key/i, f)
  }
  const importCore = readFileSync('src/lib/admin/youtube-import.ts', 'utf8')
  assert.match(importCore, /const SEASON_NUMBER_CONSTRAINT = 'episodes_season_id_episode_number_key'/)
})

test('record_youtube_checks: bounded batch, status and length rules kept', () => {
  const fn = fnBlock('public.record_youtube_checks')
  assert.match(fn, /returns integer/)
  assert.match(fn, /security invoker/)
  assert.doesNotMatch(fn, /security definer/)
  assert.match(fn, /set search_path = pg_catalog, public/)
  assert.match(fn, /jsonb_typeof\(p_rows\) <> 'array'/)
  assert.match(fn, /jsonb_array_length\(p_rows\) > 5000/)
  assert.equal((fn.match(/errcode = '22023'/g) ?? []).length, 2)
  assert.match(
    fn,
    /from jsonb_to_recordset\(p_rows\)\s+as r\(\s*id uuid,\s*status text,\s*duration_seconds integer,\s*title text,\s*title_ar text,\s*description text,\s*description_ar text\s*\)/
  )
  assert.match(fn, /youtube_status = r\.status/)
  assert.match(fn, /youtube_checked_at = now\(\)/)
  assert.match(
    fn,
    /youtube_duration_seconds = coalesce\(\s*nullif\(r\.duration_seconds, 0\),\s*e\.youtube_duration_seconds\s*\)/
  )
  // Admin duration override is kept: only rewritten while it still equals
  // the value derived from the previous stored seconds.
  assert.match(fn, /r\.duration_seconds > 0/)
  assert.match(fn, /e\.youtube_duration_seconds is not null/)
  assert.match(
    fn,
    /e\.duration = greatest\(1, round\(e\.youtube_duration_seconds \/ 60\.0\)\)::int/
  )
  assert.match(fn, /greatest\(1, round\(r\.duration_seconds \/ 60\.0\)\)::int/)
  assert.match(fn, /player_error_code = case when r\.status = 'ok' then null/)
  assert.match(fn, /player_error_at = case when r\.status = 'ok' then null/)
  assert.match(fn, /get diagnostics v_count = row_count/)
  assertServiceRoleOnly('public.record_youtube_checks(jsonb)')
})

/**
 * The text rule for one field: kept when edited or before the baseline, never
 * emptied. The baseline flag needs non-empty YouTube text that differs.
 */
function assertRefreshUnlessEdited(fn: string, alias: string, f: string, marker: string): void {
  const a = escape(alias)
  assert.match(
    fn,
    new RegExp(
      `\\b${f} = case\\s+when ${a}\\.${f}_edited or ${a}\\.${marker} is null then ${a}\\.${f}\\s+` +
        `else coalesce\\(nullif\\(btrim\\(r\\.${f}\\), ''\\), ${a}\\.${f}\\)\\s+end`
    ),
    `${f} refresh rule`
  )
  assert.match(
    fn,
    new RegExp(
      `\\b${f}_edited = ${a}\\.${f}_edited or \\(\\s*${a}\\.${marker} is null\\s+` +
        `and nullif\\(btrim\\(r\\.${f}\\), ''\\) is not null\\s+` +
        `and nullif\\(btrim\\(${a}\\.${f}\\), ''\\) is distinct from nullif\\(btrim\\(r\\.${f}\\), ''\\)\\s*\\)`
    ),
    `${f} baseline flag`
  )
  // Once edited stays edited: the flag is never assigned false.
  assert.doesNotMatch(fn, new RegExp(`\\b${f}_edited = false`))
}

test('record_youtube_checks: refresh unless edited, for each of the four text fields', () => {
  const fn = fnBlock('public.record_youtube_checks')
  for (const f of ['title', 'title_ar', 'description', 'description_ar']) {
    assertRefreshUnlessEdited(fn, 'e', f, 'youtube_text_baseline_at')
  }
  // The text rules never key on the check time: a run that finds no video
  // still sets youtube_checked_at, so it cannot mark the baseline.
  assert.doesNotMatch(fn, /e\.youtube_checked_at is null/)
  // The baseline is set once, only by a run where YouTube returned the video.
  assert.match(
    fn,
    /youtube_text_baseline_at = case\s+when r\.status = 'ok' then coalesce\(e\.youtube_text_baseline_at, now\(\)\)\s+else e\.youtube_text_baseline_at\s+end/
  )
  // Exactly these columns are written: never status, archived or publish_at
  // (nothing is unpublished).
  const set = fn.slice(fn.indexOf('update public.episodes e'), fn.indexOf('from jsonb_to_recordset'))
  const assigned = [...set.matchAll(/^\s{4}(\w+) =/gm)].map((m) => m[1]).sort()
  assert.deepEqual(assigned, [
    'description',
    'description_ar',
    'description_ar_edited',
    'description_edited',
    'duration',
    'player_error_at',
    'player_error_code',
    'title',
    'title_ar',
    'title_ar_edited',
    'title_edited',
    'youtube_checked_at',
    'youtube_duration_seconds',
    'youtube_status',
    'youtube_text_baseline_at',
  ])
})

test('record_short_checks: same security model, bounded batch, refresh unless edited, https thumbnail', () => {
  const fn = fnBlock('public.record_short_checks')
  assert.match(fn, /\(p_rows jsonb\)\s+returns integer/)
  assert.match(fn, /language plpgsql/)
  assert.match(fn, /security invoker/)
  assert.doesNotMatch(fn, /security definer/)
  assert.match(fn, /set search_path = ''/)
  assert.match(fn, /jsonb_typeof\(p_rows\) <> 'array'/)
  assert.match(fn, /jsonb_array_length\(p_rows\) > 5000/)
  assert.equal((fn.match(/errcode = '22023'/g) ?? []).length, 2)
  assert.match(fn, /update public\.shorts s/)
  assert.match(
    fn,
    /from jsonb_to_recordset\(p_rows\)\s+as r\(id uuid, title text, channel_name text, thumbnail_url text\)\s+where s\.id = r\.id;/
  )
  assert.match(fn, /youtube_checked_at = now\(\)/)
  for (const f of ['title', 'channel_name']) assertRefreshUnlessEdited(fn, 's', f, 'youtube_checked_at')
  assert.match(
    fn,
    /thumbnail_url = case\s+when r\.thumbnail_url like 'https:\/\/%' then r\.thumbnail_url\s+else s\.thumbnail_url\s+end/
  )
  // Only the four columns are written.
  const set = fn.slice(fn.indexOf('update public.shorts s'), fn.indexOf('from jsonb_to_recordset'))
  const assigned = [...set.matchAll(/^\s{4}(\w+) =/gm)].map((m) => m[1]).sort()
  assert.deepEqual(assigned, [
    'channel_name',
    'channel_name_edited',
    'thumbnail_url',
    'title',
    'title_edited',
    'youtube_checked_at',
  ])
  assert.match(fn, /get diagnostics v_count = row_count/)
  assertServiceRoleOnly('public.record_short_checks(jsonb)')
})

test('no destructive token anywhere in the file, comments included', () => {
  assert.doesNotMatch(sql, /\b(drop|truncate|delete)\b/i)
  assert.deepEqual(scanSql(sql).findings, [])
})

test('no grant names anon or authenticated, and nothing is granted on vault', () => {
  const statements = code.split(';').map((s) => s.trim())
  const grants = statements.filter((s) => /^grant\b/i.test(s))
  assert.ok(grants.length >= 8)
  for (const g of grants) {
    assert.doesNotMatch(g, /\b(anon|authenticated|public)\b\s*$/i, g)
    assert.doesNotMatch(g, /\bto\b[\s\S]*\b(anon|authenticated)\b/i, g)
    assert.doesNotMatch(g, /\bvault\./i, g)
    assert.match(g, /\bto service_role$/, g)
  }
  assert.doesNotMatch(code, /^grant .*(anon|authenticated)/im)
  assert.doesNotMatch(code, /grant .* on .*vault\./i)
  assert.match(code, /grant usage on schema private to service_role;/)
})

test('Vault guard raises a clear error when Vault is missing', () => {
  assert.match(
    code,
    /to_regprocedure\('vault\.create_secret\(text,text,text,uuid\)'\) is null/
  )
  assert.match(code, /to_regclass\('vault\.decrypted_secrets'\) is null/)
  const guard = code.indexOf("to_regclass('vault.decrypted_secrets')")
  const firstPrivate = code.indexOf('create or replace function private.')
  assert.ok(guard > -1 && guard < firstPrivate)
})

test('Vault key functions: three definers in private, three invoker wrappers', () => {
  const getKey = fnBlock('private.get_youtube_key')
  assert.match(getKey, /returns text/)
  assert.match(getKey, /language sql/)
  assert.match(getKey, /security definer/)
  assert.match(getKey, /set search_path = ''/)
  assert.match(getKey, /from vault\.decrypted_secrets ds/)
  assert.match(getKey, /where ds\.name = 'youtube_api_key'/)

  const setKey = fnBlock('private.set_youtube_key')
  assert.match(setKey, /\(p_key text\)/)
  assert.match(setKey, /returns text/)
  assert.match(setKey, /language plpgsql/)
  assert.match(setKey, /security definer/)
  assert.match(setKey, /set search_path = ''/)
  assert.match(setKey, /p_key ~ '\^AIza\[0-9A-Za-z_-\]\{35\}\$'/)
  assert.match(setKey, /errcode = '22023',\s*message = 'Invalid key format'/)
  // The rejected value never goes into the error.
  assert.doesNotMatch(setKey, /message = [^;]*p_key/)
  assert.doesNotMatch(setKey, /raise (notice|log|info|warning)/i)
  assert.match(setKey, /from vault\.secrets s\s+where s\.name = 'youtube_api_key'/)
  assert.match(
    setKey,
    /perform vault\.create_secret\(\s*p_key,\s*'youtube_api_key',\s*'YouTube Data API key \(D-20\)'\s*\)/
  )
  assert.match(setKey, /perform vault\.update_secret\(v_id, p_key\)/)
  assert.match(setKey, /return right\(p_key, 4\)/)

  const meta = fnBlock('private.youtube_key_meta')
  assert.match(
    meta,
    /returns table \(\s*has_key boolean,\s*last4 text,\s*updated_at timestamptz\s*\)/
  )
  assert.match(meta, /security definer/)
  assert.match(meta, /set search_path = ''/)
  assert.match(meta, /right\(ds\.decrypted_secret, 4\)/)
  assert.match(meta, /false, null::text, null::timestamptz/)
  // The plaintext only ever leaves meta as its last four characters.
  assert.equal(
    (meta.match(/ds\.decrypted_secret\b/g) ?? []).length,
    (meta.match(/right\(ds\.decrypted_secret, 4\)/g) ?? []).length
  )

  for (const name of ['get_youtube_key', 'set_youtube_key', 'youtube_key_meta']) {
    const w = fnBlock(`public.${name}`)
    assert.match(w, /language sql/, name)
    assert.match(w, /security invoker/, name)
    assert.doesNotMatch(w, /security definer/, name)
    assert.match(w, /set search_path = ''/, name)
    assert.match(w, new RegExp(`select (\\* from )?private\\.${name}\\(`), name)
  }

  assert.equal((code.match(/security definer/g) ?? []).length, 3)
  for (const sig of [
    'private.get_youtube_key()',
    'private.set_youtube_key(text)',
    'private.youtube_key_meta()',
    'public.get_youtube_key()',
    'public.set_youtube_key(text)',
    'public.youtube_key_meta()',
  ]) {
    assertServiceRoleOnly(sig)
  }
})

test('no other new migration mentions youtube_api_key (contract is a separate PR)', () => {
  const fresh = files.filter((f) => f > PRE_PHASE6_LAST && f !== FILE)
  for (const f of fresh) {
    const text = readFileSync(DIR + f, 'utf8')
    assert.doesNotMatch(text, /youtube_api_key/, f)
  }
  assert.equal(
    files.filter((f) => f.includes('drop_app_config_youtube_api_key')).length,
    0
  )
})
