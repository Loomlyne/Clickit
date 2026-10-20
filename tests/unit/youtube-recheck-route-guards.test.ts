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

const TODO_AUTH =
  '// TODO(phase-2): swap the inline Bearer check for cronAuthOk(header, secret) from src/server/cron-auth.ts (constant time)'
const TODO_SCHEDULE =
  "// TODO(phase-2): register '30 1 * * *' -> /api/cron/youtube-recheck in CRON_ROUTES (src/server/cron-schedule.ts) and wrangler.jsonc triggers.crons"

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

test('auth block has the publish-scheduled shape and runs before any other work', () => {
  const block = [
    "const authHeader = req.headers.get('authorization')",
    'const cronSecret = process.env.CRON_SECRET?.trim()',
    'const expected = `Bearer ${cronSecret}`',
    'if (!cronSecret || authHeader !== expected) {',
    "return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })",
  ]
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

test('both TODO(phase-2) markers are present, the auth one right above the check', () => {
  assert.equal(route.split('TODO(phase-2)').length - 1, 2)
  assert.ok(route.includes(TODO_AUTH))
  assert.ok(route.includes(TODO_SCHEDULE))
  assert.ok(route.indexOf(TODO_SCHEDULE) < route.indexOf('import '), 'schedule TODO sits at the top')
  const authTodo = route.indexOf(TODO_AUTH)
  assert.ok(authTodo > route.indexOf('export async function GET'))
  assert.ok(authTodo < route.indexOf("req.headers.get('authorization')"))
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

test('route does no cache tagging and imports no Phase 2 module', () => {
  assert.doesNotMatch(route, /updateTag|revalidateTag|revalidatePath/)
  // The TODO comments name the Phase 2 files; no import may use them yet.
  assert.doesNotMatch(route, /from ['"][^'"]*(cron-auth|cron-schedule|scheduled)['"]/)
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
