// Admin session cookie for the stop-line run (plan 02.1-01). Koss runs this in his own terminal.
// The password is typed at a hidden prompt, the Cookie header line goes to a mode 600 file outside
// every git work tree, and stdout only ever holds counts, times and the admin line.
//
// Sign-in goes through @supabase/ssr createServerClient with an in-memory jar, so the cookie names
// and chunking are the app's own.
//
// Sign-out: an unexpired token logs out directly. An expired one refreshes once first, because a
// logout with an expired token is refused and the session row would stay. The refreshed tokens are
// written back to the file before the logout, because a retry with the old refresh token would be
// token reuse and revoke the session family. The file is deleted only after a successful logout.
//
// Exit: 0 done; 1 failed or session left; 2 usage or refused; 3 captcha required.
//
// Usage:
//   node scripts/cf/make-session-cookie.mjs --env-file <f> --email <a> --out <file>
//   node scripts/cf/make-session-cookie.mjs --check <file>
//   node scripts/cf/make-session-cookie.mjs --env-file <f> --sign-out <file>
//   node scripts/cf/make-session-cookie.mjs --env-file <f> --sign-out-all <dir>
// Loopback only: --password-stdin, --force-refresh-first

import { existsSync, readFileSync, readdirSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

export const LIVE_SUPABASE_URL = 'https://lajguozmtissnnfccmej.supabase.co'
export const COOKIE_FILE_PATTERN = /^stop-line-admin-.*\.cookie$/
const FILE_MODE = 0o600
// A token this close to expiry is treated as expired, so the logout is not refused mid-flight.
const EXPIRY_MARGIN_S = 30

export const USAGE = `make-session-cookie: admin session cookie file for the stop-line run
  --env-file <file>      NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY;
                         required for sign-in and both sign-out forms
  --email <address>      account to sign in
  --out <file>           new file outside every git work tree, written mode 600
  --check <file>         print mode, expiry and minutes left (no network)
  --sign-out <file>      end that session, then delete the file
  --sign-out-all <dir>   the same for every stop-line-admin-*.cookie in dir
  --password-stdin       loopback only: read the password from stdin
  --force-refresh-first  loopback only: refresh before the logout, to measure that path
  --help`

export class UsageError extends Error {}

export function parseArgs(argv) {
  const out = {
    envFile: null,
    email: null,
    out: null,
    check: null,
    signOut: null,
    signOutAll: null,
    passwordStdin: false,
    forceRefreshFirst: false,
    help: false,
  }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    const next = () => {
      const v = argv[++i]
      if (v === undefined || v.startsWith('--')) throw new UsageError(`${a} needs a value`)
      return v
    }
    if (a === '--help' || a === '-h') out.help = true
    else if (a === '--env-file') out.envFile = next()
    else if (a === '--email') out.email = next()
    else if (a === '--out') out.out = next()
    else if (a === '--check') out.check = next()
    else if (a === '--sign-out') out.signOut = next()
    else if (a === '--sign-out-all') out.signOutAll = next()
    else if (a === '--password-stdin') out.passwordStdin = true
    else if (a === '--force-refresh-first') out.forceRefreshFirst = true
    else throw new UsageError(`unknown argument ${a}`)
  }
  return out
}

export function isLoopbackUrl(value) {
  try {
    const url = new URL(value)
    return url.protocol === 'http:' && (url.hostname === '127.0.0.1' || url.hostname === 'localhost')
  } catch {
    return false
  }
}

/** Loopback or the exact live project; the two loopback-only flags refuse anything else. */
export function checkTarget(url, { passwordStdin = false, forceRefreshFirst = false } = {}) {
  const loopback = isLoopbackUrl(url)
  if (!loopback && url !== LIVE_SUPABASE_URL) throw new UsageError('refused: the Supabase URL is not loopback or the Clickit project')
  if (!loopback && passwordStdin) throw new UsageError('refused: --password-stdin is loopback only')
  if (!loopback && forceRefreshFirst) throw new UsageError('refused: --force-refresh-first is loopback only')
}

export function isInsideGitWorkTree(path) {
  let dir = dirname(resolve(path))
  for (;;) {
    if (existsSync(join(dir, '.git'))) return true
    const parent = dirname(dir)
    if (parent === dir) return false
    dir = parent
  }
}

export function checkOutPath(path) {
  if (isInsideGitWorkTree(path)) throw new UsageError('refused: --out is inside a git work tree')
  if (existsSync(path)) throw new UsageError('refused: --out already exists')
}

export function parseEnvText(text) {
  const out = {}
  for (const raw of String(text).split('\n')) {
    const match = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)=(.*)$/.exec(raw)
    if (!match || raw.trim().startsWith('#')) continue
    out[match[1]] = match[2].trim().replace(/^(["'])(.*)\1$/, '$2')
  }
  return out
}

export function readEnvFile(path) {
  const env = parseEnvText(readFileSync(path, 'utf8'))
  const url = env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !anonKey) throw new UsageError('the env file lacks NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY')
  return { url, anonKey }
}

/** Write the Cookie header line: mode 600, never over an existing file, mode read back. */
export function writeCookieFile(path, cookies) {
  const line = cookies.map(({ name, value }) => `${name}=${value}`).join('; ')
  const before = process.umask(0o077)
  try {
    writeFileSync(path, `${line}\n`, { flag: 'wx', mode: FILE_MODE })
  } finally {
    process.umask(before)
  }
  const mode = statSync(path).mode & 0o777
  if (mode !== FILE_MODE) throw new Error(`cookie file mode is ${mode.toString(8)}, expected 600`)
  return Buffer.byteLength(line)
}

/** The session stored in a Cookie header line: chunks joined in order, base64- prefix removed. */
export function parseCookieLine(line) {
  const parts = new Map()
  let baseName = null
  for (const pair of String(line).trim().split(/;\s*/)) {
    const at = pair.indexOf('=')
    if (at < 1) continue
    const match = /^(sb-.+-auth-token)(?:\.(\d+))?$/.exec(pair.slice(0, at))
    if (!match) continue
    baseName = match[1]
    parts.set(match[2] === undefined ? 0 : Number(match[2]), pair.slice(at + 1))
  }
  if (!baseName || parts.size === 0) throw new Error('no auth cookie in the file')
  const joined = [...parts.keys()].sort((a, b) => a - b).map((k) => parts.get(k)).join('')
  const encoded = joined.startsWith('base64-') ? joined.slice('base64-'.length) : joined
  const session = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'))
  if (typeof session?.access_token !== 'string' || typeof session?.refresh_token !== 'string') {
    throw new Error('no session in the auth cookie')
  }
  return { baseName, session, chunks: parts.size }
}

function jwtExp(token) {
  try {
    const exp = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8')).exp
    return typeof exp === 'number' ? exp : null
  } catch {
    return null
  }
}

export function sessionExpiry(session) {
  return jwtExp(session.access_token) ?? (typeof session.expires_at === 'number' ? session.expires_at : null)
}

export function checkFile(path, nowMs = Date.now()) {
  const mode = (statSync(path).mode & 0o777).toString(8)
  const { session } = parseCookieLine(readFileSync(path, 'utf8'))
  const exp = sessionExpiry(session)
  const minutes = exp === null ? null : Math.floor((exp * 1000 - nowMs) / 60_000)
  return { mode, expires: exp === null ? 'unknown' : new Date(exp * 1000).toISOString(), minutesLeft: minutes }
}

function isCaptchaError(error) {
  return /captcha/i.test(`${error?.code ?? ''} ${error?.message ?? ''}`)
}

/**
 * signIn({ url, anonKey, email, password, fetchImpl }) ->
 * { captcha: true } | { failed: code } | { cookies, session, admin }
 */
export async function signIn({ url, anonKey, email, password, fetchImpl = fetch }) {
  const { createServerClient } = await import('@supabase/ssr')
  const jar = new Map()
  const client = createServerClient(url, anonKey, {
    global: { fetch: fetchImpl },
    cookies: {
      getAll: () => [...jar].map(([name, value]) => ({ name, value })),
      setAll: (items) => {
        for (const { name, value } of items) {
          if (value === '') jar.delete(name)
          else jar.set(name, value)
        }
      },
    },
  })
  const { data, error } = await client.auth.signInWithPassword({ email, password })
  if (error) return isCaptchaError(error) ? { captcha: true } : { failed: error.code ?? error.status ?? 'unknown' }
  if (!data?.session) return { failed: 'no-session' }
  const { data: config } = await client.from('app_config').select('admin_user_id').eq('id', 1).single()
  const cookies = [...jar].map(([name, value]) => ({ name, value }))
  if (cookies.length === 0) return { failed: 'no-cookie' }
  return { cookies, session: data.session, admin: config?.admin_user_id === data.user?.id }
}

async function authPost({ url, anonKey, path, bearer, body, fetchImpl }) {
  const headers = { apikey: anonKey, 'content-type': 'application/json' }
  if (bearer) headers.authorization = `Bearer ${bearer}`
  return fetchImpl(`${url}/auth/v1/${path}`, { method: 'POST', headers, body: body ? JSON.stringify(body) : undefined })
}

function replaceFile(path, line) {
  const temp = `${path}.tmp`
  const before = process.umask(0o077)
  try {
    writeFileSync(temp, `${line}\n`, { mode: FILE_MODE })
    renameSync(temp, path)
  } finally {
    process.umask(before)
  }
}

/** -> 'signed out' | 'signed out (refreshed first)' | 'session left' */
export async function signOutFile(path, { url, anonKey, fetchImpl = fetch, nowMs = Date.now(), forceRefreshFirst = false }) {
  let parsed
  try {
    parsed = parseCookieLine(readFileSync(path, 'utf8'))
  } catch {
    return 'session left'
  }
  let { access_token: accessToken } = parsed.session
  const exp = sessionExpiry(parsed.session)
  const expired = exp === null || exp - EXPIRY_MARGIN_S <= nowMs / 1000
  const refreshFirst = expired || forceRefreshFirst
  try {
    if (refreshFirst) {
      const res = await authPost({
        url,
        anonKey,
        path: 'token?grant_type=refresh_token',
        body: { refresh_token: parsed.session.refresh_token },
        fetchImpl,
      })
      if (!res.ok) return 'session left'
      const fresh = await res.json()
      if (typeof fresh?.access_token !== 'string' || typeof fresh?.refresh_token !== 'string') return 'session left'
      replaceFile(path, `${parsed.baseName}=base64-${Buffer.from(JSON.stringify(fresh), 'utf8').toString('base64url')}`)
      accessToken = fresh.access_token
    }
    const res = await authPost({ url, anonKey, path: 'logout?scope=local', bearer: accessToken, fetchImpl })
    if (!res.ok) return 'session left'
  } catch {
    return 'session left'
  }
  rmSync(path, { force: true })
  return refreshFirst ? 'signed out (refreshed first)' : 'signed out'
}

/** -> { 'signed out': n, 'signed out (refreshed first)': n, 'session left': n } */
export async function signOutAll(dir, options) {
  const counts = { 'signed out': 0, 'signed out (refreshed first)': 0, 'session left': 0 }
  for (const name of readdirSync(dir).filter((n) => COOKIE_FILE_PATTERN.test(n)).sort()) {
    counts[await signOutFile(join(dir, name), options)]++
  }
  return counts
}

async function readHiddenPassword(stdin, stderr) {
  stderr.write('Password: ')
  return new Promise((resolvePassword, reject) => {
    let value = ''
    stdin.setRawMode(true)
    stdin.resume()
    stdin.setEncoding('utf8')
    const finish = (fn) => {
      stdin.setRawMode(false)
      stdin.pause()
      stdin.removeListener('data', onData)
      stderr.write('\n')
      fn()
    }
    const onData = (chunk) => {
      for (const ch of chunk) {
        if (ch === '\r' || ch === '\n' || ch === '\u0004') return finish(() => resolvePassword(value))
        if (ch === '\u0003') return finish(() => reject(new UsageError('cancelled')))
        if (ch === '\u007f' || ch === '\b') value = value.slice(0, -1)
        else value += ch
      }
    }
    stdin.on('data', onData)
  })
}

async function readPasswordLine(stdin) {
  let text = ''
  for await (const chunk of stdin) text += chunk
  return text.split('\n')[0]
}

export async function main(argv, deps = {}) {
  const stdout = deps.stdout ?? process.stdout
  const stderr = deps.stderr ?? process.stderr
  const fetchImpl = deps.fetchImpl ?? fetch
  const nowMs = deps.nowMs ?? Date.now()
  try {
    const args = parseArgs(argv)
    if (args.help) {
      stdout.write(`${USAGE}\n`)
      return 0
    }
    if (args.check) {
      const { mode, expires, minutesLeft } = checkFile(args.check, nowMs)
      stdout.write(`mode ${mode}, expires ${expires}, minutes left ${minutesLeft}\n`)
      return 0
    }
    if (!args.envFile) throw new UsageError(`--env-file is required\n${USAGE}`)
    const { url, anonKey } = deps.env ?? readEnvFile(args.envFile)
    checkTarget(url, args)

    if (args.signOut || args.signOutAll) {
      const options = { url, anonKey, fetchImpl, nowMs, forceRefreshFirst: args.forceRefreshFirst }
      if (args.signOut) {
        const result = await signOutFile(args.signOut, options)
        stdout.write(`${result}\n`)
        return result === 'session left' ? 1 : 0
      }
      const counts = await signOutAll(args.signOutAll, options)
      for (const [result, count] of Object.entries(counts)) stdout.write(`${result}: ${count}\n`)
      return counts['session left'] > 0 ? 1 : 0
    }

    if (!args.email || !args.out) throw new UsageError(`--email and --out are required\n${USAGE}`)
    checkOutPath(args.out)
    const stdin = deps.stdin ?? process.stdin
    let password
    if (deps.password !== undefined) password = deps.password
    else if (args.passwordStdin) password = await readPasswordLine(stdin)
    else if (stdin.isTTY) password = await readHiddenPassword(stdin, stderr)
    else throw new UsageError('refused: the password prompt needs a terminal')

    const result = await signIn({ url, anonKey, email: args.email, password, fetchImpl })
    if (result.captcha) {
      stderr.write('captcha required\n')
      return 3
    }
    if (result.failed) {
      stderr.write(`sign-in failed: ${result.failed}\n`)
      return 1
    }
    const bytes = writeCookieFile(args.out, result.cookies)
    const exp = sessionExpiry(result.session)
    const expires = exp === null ? 'unknown' : new Date(exp * 1000).toISOString()
    stdout.write(`cookie written (${bytes} bytes, ${result.cookies.length} chunks), expires ${expires}, admin: ${result.admin ? 'yes' : 'no'}\n`)
    return 0
  } catch (error) {
    stderr.write(`${error instanceof UsageError ? error.message : `failed: ${error?.name ?? 'error'}`}\n`)
    return error instanceof UsageError ? 2 : 1
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  process.exitCode = await main(process.argv.slice(2))
}
