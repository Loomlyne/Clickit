// Helpers for scripts that must only ever touch the LOCAL Supabase stack.
// Never imported by app code. Nothing here prints or returns a secret.
//
//   assertLocalSupabaseUrl(url)        throws unless http://127.0.0.1|localhost|[::1]
//   writePrivateEnvFile(path, values)  KEY=value file, mode 600, outside the repo
//   resolveM2Source(repoRoot)          landed M2 migration, else supabase/pending
//   localDbExecArgs(sqlPath)           docker exec argv for psql in supabase_db_Clickit
//   migrationVersionOf(sqlPath)        { version, name } for a migrations file, else null
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const LOCAL_DB_CONTAINER = 'supabase_db_Clickit'

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const LOCAL_HOSTS = new Set(['127.0.0.1', 'localhost', '[::1]'])

const M2_MIGRATION_RE = /^(\d{14})_phase5_m2_admin_aal2\.sql$/
const M2_NOT_FOUND =
  'M2 source not found: neither supabase/migrations/*_phase5_m2_admin_aal2.sql nor supabase/pending/m2_admin_aal2.sql'

/**
 * Returns the URL without a trailing slash when it points at the local stack;
 * throws for live, any https URL, credentials in the URL or any other host.
 */
export function assertLocalSupabaseUrl(url) {
  let u
  try {
    u = new URL(String(url ?? ''))
  } catch {
    throw new Error('refusing: Supabase URL is not a valid local URL')
  }
  if (u.protocol !== 'http:' || !LOCAL_HOSTS.has(u.hostname) || u.username || u.password) {
    throw new Error(`refusing: ${u.protocol}//${u.hostname} is not the local Supabase stack (http://127.0.0.1 or http://localhost only)`)
  }
  return `${u.protocol}//${u.host}${u.pathname.replace(/\/+$/, '')}`
}

function isInside(child, parent) {
  const rel = path.relative(parent, child)
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel))
}

/**
 * Writes `KEY=value\n` lines with file mode 600 (also when the file existed).
 * Refuses relative paths, paths inside this repo, bad keys and values with
 * newlines. Written to a temp file in the same folder, then renamed.
 */
export function writePrivateEnvFile(filePath, values, { repoRoot = REPO_ROOT } = {}) {
  if (typeof filePath !== 'string' || !path.isAbsolute(filePath)) {
    throw new Error('writePrivateEnvFile: path must be absolute')
  }
  const target = path.resolve(filePath)
  if (isInside(target, path.resolve(repoRoot))) {
    throw new Error('writePrivateEnvFile: refusing a path inside the repo (public repo; credentials stay outside)')
  }
  let body = ''
  for (const [key, value] of Object.entries(values)) {
    if (!/^[A-Z_][A-Z0-9_]*$/i.test(key)) throw new Error(`writePrivateEnvFile: bad key ${JSON.stringify(key)}`)
    const v = String(value)
    if (/[\r\n]/.test(v)) throw new Error(`writePrivateEnvFile: value for ${key} contains a newline`)
    body += `${key}=${v}\n`
  }
  const dir = path.dirname(target)
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 })
  const tmp = path.join(dir, `.${path.basename(target)}.${process.pid}.tmp`)
  try {
    fs.writeFileSync(tmp, body, { mode: 0o600 })
    fs.chmodSync(tmp, 0o600)
    fs.renameSync(tmp, target)
  } finally {
    fs.rmSync(tmp, { force: true })
  }
  fs.chmodSync(target, 0o600)
  return target
}

/**
 * Where M2 comes from: the landed migration (05-41, newest if several), else
 * the pending file (05-14), else throws M2_NOT_FOUND. Pure over listDir/exists.
 */
export function resolveM2Source(repoRoot, { listDir = fs.readdirSync, exists = fs.existsSync } = {}) {
  const migDir = path.join(repoRoot, 'supabase', 'migrations')
  let names = []
  try {
    names = listDir(migDir)
  } catch {
    names = []
  }
  const landed = names.filter((n) => M2_MIGRATION_RE.test(n)).sort()
  if (landed.length > 0) return path.join(migDir, landed[landed.length - 1])
  const pending = path.join(repoRoot, 'supabase', 'pending', 'm2_admin_aal2.sql')
  if (exists(pending)) return pending
  throw new Error(M2_NOT_FOUND)
}

/**
 * argv for `docker exec -i supabase_db_Clickit psql ...`; the SQL file goes on
 * stdin (execFileSync `input`). No host flag, no shell string. The path is
 * checked (absolute, .sql) so callers cannot pass something else by mistake.
 */
export function localDbExecArgs(sqlPath) {
  if (typeof sqlPath !== 'string' || !path.isAbsolute(sqlPath)) {
    throw new Error('localDbExecArgs: path must be absolute')
  }
  if (!sqlPath.endsWith('.sql')) throw new Error('localDbExecArgs: expected a .sql file')
  return [
    'exec',
    '-i',
    LOCAL_DB_CONTAINER,
    'psql',
    '-q',
    '-X',
    '-v',
    'ON_ERROR_STOP=1',
    '--single-transaction',
    '-U',
    'postgres',
    '-d',
    'postgres',
  ]
}

/** `{ version, name }` for supabase/migrations/<14 digits>_<name>.sql, else null. */
export function migrationVersionOf(sqlPath) {
  if (path.basename(path.dirname(sqlPath)) !== 'migrations') return null
  const m = /^(\d{14})_([a-z0-9_]+)\.sql$/.exec(path.basename(sqlPath))
  return m ? { version: m[1], name: m[2] } : null
}
