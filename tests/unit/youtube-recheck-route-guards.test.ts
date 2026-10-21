// Source guards for GET /api/cron/youtube-recheck and the server YouTube
// client factory (D-17, D-20, plan gate G8). The route imports next/* and @/
// paths, so node --test checks its source; the logic it calls
// (recheckVideosCore) is tested in youtube-recheck.test.ts.
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { test } from 'node:test'

const ROUTE = 'src/app/api/cron/youtube-recheck/route.ts'
const SERVICE = 'src/server/youtube-service.ts'
const route = readFileSync(ROUTE, 'utf8')
const service = readFileSync(SERVICE, 'utf8')


/** Every console.* call with its full argument text (balanced parentheses). */
function consoleCalls(src: string): string[] {
  const out: string[] = []
  const re = /console\.\w+\(/g
  let m: RegExpExecArray | null
  while ((m = re.exec(src))) {
    let depth = 1
    let i = m.index + m[0].length
    while (i < src.length && depth > 0) {
      if (src[i] === '(') depth += 1
      else if (src[i] === ')') depth -= 1
      i += 1
    }
    out.push(src.slice(m.index, i))
  }
  return out
}

test('route exports GET', () => {
  assert.match(route, /export async function GET\(req: Request\)/)
})

test('auth block is the constant-time check and runs before any other work', () => {
  const block = [
    "const authHeader = req.headers.get('authorization')",
    'if (!(await cronAuthOk(authHeader, process.env.CRON_SECRET))) {',
    "return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })",
  ]
  assert.ok(route.includes("import { cronAuthOk } from '@/server/cron-auth'"))
  assert.ok(!route.includes('bearerMatches'), 'the Phase 6 inline check is gone')
  // No plain string compare of the header is left.
  assert.doesNotMatch(route, /authHeader\s*[!=]==/)
  assert.doesNotMatch(route, /[!=]==\s*authHeader/)
  let at = route.indexOf('export async function GET')
  for (const line of block) {
    const i = route.indexOf(line, at)
    assert.ok(i > at, `missing or out of order: ${line}`)
    at = i
  }
  const authEnd = at
  for (const later of ['getServerYouTubeClient(', 'createAdminClient(', 'recheckVideosCore(']) {
    const i = route.indexOf(later, route.indexOf('export async function GET'))
    assert.ok(i > authEnd, `${later} must come after the auth check`)
  }
})

test('Phase 2 wired the route: no TODO(phase-2) left, schedule in CRON_ROUTES', () => {
  assert.ok(!route.includes('TODO(phase-2)'))
  const map = readFileSync('src/server/cron-schedule.ts', 'utf8')
  assert.ok(map.includes("'30 1 * * *': '/api/cron/youtube-recheck'"))
})

test('missing key: 503 key_missing; otherwise recheckVideosCore', () => {
  assert.ok(route.includes('getServerYouTubeClient()'))
  assert.match(route, /\{ ok: false, reason: 'key_missing' \},\s*\{ status: 503 \}/)
  assert.ok(route.includes('recheckVideosCore(createAdminClient(), '))
  assert.ok(route.includes('new Date()'))
})

test('quota and key errors return 200 with the reason (no retry storm)', () => {
  assert.match(route, /YOUTUBE_REASONS/)
  for (const r of ['quota', 'key_rejected', 'api_not_allowed', 'network'])
    assert.ok(route.includes(`'${r}'`), `200 reason list includes ${r}`)
  assert.match(route, /YOUTUBE_REASONS\.has\(result\.reason\) \? 200 : 500/)
  assert.match(route, /\{ ok: false, reason: result\.reason \}/)
})

test('logs use the [cron/youtube-recheck] prefix and never mention a key, url or body', () => {
  for (const src of [route, service]) {
    for (const call of consoleCalls(src)) {
      assert.doesNotMatch(call, /apiKey|key|url|body|res\.|response/i, call)
    }
  }
  const routeLogs = consoleCalls(route)
  assert.ok(routeLogs.length > 0)
  for (const call of routeLogs) assert.ok(call.includes("'[cron/youtube-recheck]"), call)
})

test('route does no cache tagging; its only Phase 2 import is cron-auth', () => {
  assert.doesNotMatch(route, /updateTag|revalidateTag|revalidatePath/)
  // Phase 2 wired the auth (cronAuthOk); the schedule lives in cron-schedule.ts,
  // which the route itself must not import.
  assert.doesNotMatch(route, /from ['"][^'"]*(cron-schedule|scheduled)['"]/)
})

test('youtube-service starts with server-only and builds the client from the Vault key, header only', () => {
  assert.ok(service.startsWith("import 'server-only'"))
  assert.ok(service.includes('readYouTubeApiKey()'))
  assert.ok(service.includes('createYouTubeClient({ apiKey'))
  const code = service.replace(/^\s*\/\/.*$/gm, '')
  assert.ok(code.includes('createYouTubeClient({ apiKey })'), 'no option besides apiKey')
  assert.doesNotMatch(code, /fetchImpl|transport|keyTransport|process\.env/)
  assert.match(service, /export async function getServerYouTubeClient\(\)/)
  assert.match(service, /\{ missing: true \}/)
})

test('no Vercel cron for the re-check (Vercel is frozen)', () => {
  if (existsSync('vercel.json'))
    assert.doesNotMatch(readFileSync('vercel.json', 'utf8'), /youtube-recheck/)
})
