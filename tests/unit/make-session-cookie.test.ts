import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { checkOutPath, checkTarget, main, parseCookieLine, writeCookieFile } from '../../scripts/cf/make-session-cookie.mjs'

const LOCAL = 'http://127.0.0.1:55321'
const LIVE = 'https://lajguozmtissnnfccmej.supabase.co'
const NOW = Date.parse('2026-10-31T12:00:00Z')
const dir = () => realpathSync(mkdtempSync(join(tmpdir(), 'sl-cookie-')))

function jwt(expSeconds: number) {
  const enc = (v: unknown) => Buffer.from(JSON.stringify(v)).toString('base64url')
  return `${enc({ alg: 'none' })}.${enc({ exp: expSeconds, sub: 'u1' })}.sig`
}
// Sign-in runs the real auth client, which reads the wall clock, so this token is relative to it.
const REAL_NOW_S = Math.floor(Date.now() / 1000)
const ACCESS_SECRET = jwt(REAL_NOW_S + 3600)
const REFRESH_SECRET = 'refresh-token-secret-value'

function cookieLine(accessToken: string, refreshToken = REFRESH_SECRET) {
  const value = Buffer.from(JSON.stringify({ access_token: accessToken, refresh_token: refreshToken })).toString('base64url')
  return `sb-127-auth-token=base64-${value}\n`
}

function sink() {
  const lines: string[] = []
  return { write: (s: string) => lines.push(s), text: () => lines.join('') }
}

type Call = { url: string; bearer: string | null; body: string | null }
function authServer(handlers: { refresh?: number; logout?: number; signIn?: Response }) {
  const calls: Call[] = []
  const fetchImpl = async (input: string | URL, init: RequestInit = {}) => {
    const url = String(input)
    const headers = new Headers(init.headers)
    calls.push({ url, bearer: headers.get('authorization'), body: (init.body as string) ?? null })
    if (url.includes('/auth/v1/logout')) return new Response(null, { status: handlers.logout ?? 204 })
    if (url.includes('grant_type=refresh_token')) {
      const status = handlers.refresh ?? 200
      if (status !== 200) return new Response('{}', { status })
      return Response.json({ access_token: jwt(NOW / 1000 + 3600), refresh_token: 'rotated-refresh', expires_at: NOW / 1000 + 3600 })
    }
    if (url.includes('grant_type=password')) {
      return (
        handlers.signIn ??
        Response.json({
          access_token: ACCESS_SECRET,
          refresh_token: REFRESH_SECRET,
          token_type: 'bearer',
          expires_in: 3600,
          expires_at: REAL_NOW_S + 3600,
          user: { id: 'u1', aud: 'authenticated', email: 'a@example.test' },
        })
      )
    }
    if (url.includes('/rest/v1/app_config')) return Response.json({ admin_user_id: 'u1' })
    return new Response('{}', { status: 404 })
  }
  return { calls, fetchImpl: fetchImpl as unknown as typeof fetch }
}

const env = { url: LOCAL, anonKey: 'anon' }

test('refuses an --out inside a git work tree', () => {
  const root = dir()
  mkdirSync(join(root, '.git'))
  assert.throws(() => checkOutPath(join(root, 'nested.cookie')), /git work tree/)
})

test('refuses an --out that already exists', () => {
  const root = dir()
  const path = join(root, 'x.cookie')
  writeFileSync(path, 'x')
  assert.throws(() => checkOutPath(path), /already exists/)
  assert.throws(() => writeCookieFile(path, [{ name: 'a', value: 'b' }]))
  assert.equal(readFileSync(path, 'utf8'), 'x')
})

test('refuses a URL other than loopback or the live project', () => {
  assert.doesNotThrow(() => checkTarget(LOCAL))
  assert.doesNotThrow(() => checkTarget(LIVE))
  assert.throws(() => checkTarget('https://other.supabase.co'), /refused/)
  assert.throws(() => checkTarget(`${LIVE}.evil.test`), /refused/)
})

test('refuses --password-stdin and --force-refresh-first on a non-loopback URL', () => {
  assert.throws(() => checkTarget(LIVE, { passwordStdin: true }), /loopback only/)
  assert.throws(() => checkTarget(LIVE, { forceRefreshFirst: true }), /loopback only/)
  assert.doesNotThrow(() => checkTarget(LOCAL, { passwordStdin: true, forceRefreshFirst: true }))
})

test('sign-in writes mode 600 through the app cookie code, and stdout holds neither token', async () => {
  const root = dir()
  const out = join(root, 'stop-line-admin-1.cookie')
  const server = authServer({})
  const stdout = sink()
  const code = await main(['--env-file', 'unused', '--email', 'a@example.test', '--out', out], {
    env,
    password: 'throwaway',
    fetchImpl: server.fetchImpl,
    stdout,
    stderr: sink(),
  })
  assert.equal(code, 0)
  assert.equal(statSync(out).mode & 0o777, 0o600)
  assert.match(stdout.text(), /^cookie written \(\d+ bytes, \d+ chunks\), expires \d{4}-\d{2}-\d{2}T[\d:.]+Z, admin: yes\n$/)
  assert.ok(!stdout.text().includes(ACCESS_SECRET))
  assert.ok(!stdout.text().includes(REFRESH_SECRET))
  const { session, baseName } = parseCookieLine(readFileSync(out, 'utf8'))
  assert.equal(session.access_token, ACCESS_SECRET)
  assert.equal(session.refresh_token, REFRESH_SECRET)
  assert.equal(baseName, 'sb-127-auth-token')
})

test('a captcha demand exits 3 with the fixed line and writes no file', async () => {
  const root = dir()
  const out = join(root, 'c.cookie')
  const server = authServer({
    signIn: Response.json({ code: 400, error_code: 'captcha_failed', msg: 'captcha protection: request disallowed' }, { status: 400 }),
  })
  const stderr = sink()
  const code = await main(['--env-file', 'unused', '--email', 'a@example.test', '--out', out], {
    env,
    password: 'x',
    fetchImpl: server.fetchImpl,
    stdout: sink(),
    stderr,
  })
  assert.equal(code, 3)
  assert.match(stderr.text(), /captcha required/)
  assert.equal(existsSync(out), false)
})

function cookieFile(accessToken: string) {
  const root = dir()
  const path = join(root, 'stop-line-admin-1.cookie')
  writeFileSync(path, cookieLine(accessToken), { mode: 0o600 })
  return { root, path }
}
const run = async (argv: string[], server: ReturnType<typeof authServer>) => {
  const stdout = sink()
  const code = await main(argv, { env, fetchImpl: server.fetchImpl, nowMs: NOW, stdout, stderr: sink() })
  return { code, out: stdout.text() }
}

test('sign-out: an unexpired token logs out once, prints signed out, deletes the file', async () => {
  const { path } = cookieFile(jwt(NOW / 1000 + 3600))
  const server = authServer({})
  const { code, out } = await run(['--env-file', 'x', '--sign-out', path], server)
  assert.equal(code, 0)
  assert.equal(out, 'signed out\n')
  assert.equal(server.calls.length, 1)
  assert.match(server.calls[0].url, /\/auth\/v1\/logout\?scope=local$/)
  assert.equal(existsSync(path), false)
})

test('sign-out: an expired token refreshes once, then logs out with the new token', async () => {
  const { path } = cookieFile(jwt(NOW / 1000 - 60))
  const server = authServer({})
  const { code, out } = await run(['--env-file', 'x', '--sign-out', path], server)
  assert.equal(code, 0)
  assert.equal(out, 'signed out (refreshed first)\n')
  assert.equal(server.calls.length, 2)
  assert.match(server.calls[0].url, /grant_type=refresh_token/)
  assert.deepEqual(JSON.parse(server.calls[0].body!), { refresh_token: REFRESH_SECRET })
  assert.ok(server.calls[1].bearer?.startsWith('Bearer '))
  assert.notEqual(server.calls[1].bearer, `Bearer ${jwt(NOW / 1000 - 60)}`)
  assert.equal(existsSync(path), false)
})

test('sign-out: a failed logout keeps the file, prints session left, exits non-zero', async () => {
  const { path } = cookieFile(jwt(NOW / 1000 + 3600))
  const { code, out } = await run(['--env-file', 'x', '--sign-out', path], authServer({ logout: 500 }))
  assert.equal(code, 1)
  assert.equal(out, 'session left\n')
  assert.equal(existsSync(path), true)
})

test('sign-out: a failed refresh keeps the file, prints session left, exits non-zero, sends no logout', async () => {
  const { path } = cookieFile(jwt(NOW / 1000 - 60))
  const server = authServer({ refresh: 400 })
  const { code, out } = await run(['--env-file', 'x', '--sign-out', path], server)
  assert.equal(code, 1)
  assert.equal(out, 'session left\n')
  assert.equal(existsSync(path), true)
  assert.equal(server.calls.length, 1)
})

test('sign-out: a logout failing after a refresh keeps the rotated token, so the retry is not token reuse', async () => {
  const { path } = cookieFile(jwt(NOW / 1000 - 60))
  const first = await run(['--env-file', 'x', '--sign-out', path], authServer({ logout: 500 }))
  assert.equal(first.out, 'session left\n')
  assert.equal(statSync(path).mode & 0o777, 0o600)
  assert.equal(parseCookieLine(readFileSync(path, 'utf8')).session.refresh_token, 'rotated-refresh')
  const retry = await run(['--env-file', 'x', '--sign-out', path], authServer({}))
  assert.equal(retry.code, 0)
  assert.equal(existsSync(path), false)
})

test('--force-refresh-first refreshes an unexpired token on loopback', async () => {
  const { path } = cookieFile(jwt(NOW / 1000 + 3600))
  const server = authServer({})
  const { out } = await run(['--env-file', 'x', '--force-refresh-first', '--sign-out', path], server)
  assert.equal(out, 'signed out (refreshed first)\n')
  assert.equal(server.calls.length, 2)
})

test('--sign-out and --sign-out-all without --env-file exit non-zero and send nothing', async () => {
  const { root, path } = cookieFile(jwt(NOW / 1000 + 3600))
  for (const argv of [['--sign-out', path], ['--sign-out-all', root]]) {
    const server = authServer({})
    const stdout = sink()
    const code = await main(argv, { fetchImpl: server.fetchImpl, nowMs: NOW, stdout, stderr: sink() })
    assert.notEqual(code, 0)
    assert.equal(server.calls.length, 0)
  }
  assert.equal(existsSync(path), true)
})

test('--sign-out-all handles every matching file, prints a count per result, exits non-zero if any session is left', async () => {
  const root = dir()
  writeFileSync(join(root, 'stop-line-admin-1.cookie'), cookieLine(jwt(NOW / 1000 + 3600)), { mode: 0o600 })
  writeFileSync(join(root, 'stop-line-admin-2.cookie'), cookieLine(jwt(NOW / 1000 - 60)), { mode: 0o600 })
  writeFileSync(join(root, 'stop-line-admin-3.cookie'), 'not a cookie', { mode: 0o600 })
  writeFileSync(join(root, 'clickit.workersdev.env'), 'KEEP=1')
  const { code, out } = await run(['--env-file', 'x', '--sign-out-all', root], authServer({}))
  assert.equal(code, 1)
  assert.match(out, /^signed out: 1\nsigned out \(refreshed first\): 1\nsession left: 1\n$/)
  assert.equal(existsSync(join(root, 'stop-line-admin-1.cookie')), false)
  assert.equal(existsSync(join(root, 'stop-line-admin-2.cookie')), false)
  assert.equal(existsSync(join(root, 'stop-line-admin-3.cookie')), true)
  assert.equal(existsSync(join(root, 'clickit.workersdev.env')), true)
})

test('--check prints mode, expiry and minutes left, and no token', async () => {
  const token = jwt(NOW / 1000 + 3000)
  const { path } = cookieFile(token)
  const { code, out } = await run(['--check', path], authServer({}))
  assert.equal(code, 0)
  assert.equal(out, 'mode 600, expires 2026-10-31T12:50:00.000Z, minutes left 50\n')
  assert.ok(!out.includes(token))
})

test('--help exits 0 and the script makes no network call', () => {
  const script = join(process.cwd(), 'scripts/cf/make-session-cookie.mjs')
  const blockNetwork = "globalThis.fetch=()=>{throw new Error('network')}"
  const result = spawnSync(process.execPath, ['--input-type=module', '-e', `${blockNetwork};process.argv=[process.argv[0],${JSON.stringify(script)},'--help'];await import(${JSON.stringify(script)})`], { encoding: 'utf8' })
  assert.equal(result.status, 0, result.stderr)
  assert.match(result.stdout, /make-session-cookie/)
  assert.match(execFileSync(process.execPath, [script, '--help'], { encoding: 'utf8' }), /--sign-out-all/)
})
