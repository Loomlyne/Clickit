// Phase 3 plan 03-02: the production (www) target, the one-Worker-two-targets rule
// (D-18) and the R2-first media env. Every value here is a synthetic fixture: no key,
// token or secret is written literally (the repo is public). JWT-shaped and sb_ keys
// are assembled at runtime.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  PRODUCTION_CRONS,
  PRODUCTION_MEDIA_ORIGIN,
  PRODUCTION_ROUTE,
  PRODUCTION_ZONE_ID,
  checkDeploy,
  checkMediaDeploy,
  checkProductionDeploy,
  checkTargetSwitch,
  parseJsonc,
} from '../../scripts/cf/deploy-guard.mjs'
import {
  PRODUCTION_ENV_FILE,
  PRODUCTION_SITE_URL,
  buildEnvFor,
  classifySupabaseKey,
  makeStamp,
} from '../../scripts/cf/build-target.mjs'
import { CRON_EXPRESSIONS_FOR_PHASE_3 } from '../../src/server/scheduled.ts'

const CLICKIT = 'e329b099b6e4272fc0915a99832e47fe'
const OTHER = '0123456789abcdef0123456789abcdef'
const SHA = '2222222222222222222222222222222222222222'
const OTHER_SHA = '3333333333333333333333333333333333333333'
const MANIFEST_SHA = 'a'.repeat(64)
const REPORT_SHA = 'b'.repeat(64)

const whoamiOk = `Getting User settings...\nAccount Name | Account ID\nClickitStory | ${CLICKIT}`
const whoamiOther = `${whoamiOk}\nVamos | ${OTHER}`

const b64url = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url')
const LEGACY_JWT = [b64url({ alg: 'HS256', typ: 'JWT' }), b64url({ role: 'anon', ref: 'fixture' }), b64url('sig')].join('.')
const PUBLISHABLE = 'sb_' + 'publishable_' + 'fixture'
const SECRET = 'sb_' + 'secret_' + 'fixture'
const REAL_TURNSTILE = '0x4AAAAAAA' + 'fixture-not-a-real-key'
const TEST_TURNSTILE = '1x' + '0'.repeat(20) + 'AA'

const EMPTY_NEXT_ENV = 'export const production = {};\nexport const development = {};\nexport const test = {};\n'

const prodFileEnv = {
  NEXT_PUBLIC_SITE_URL: 'https://www.clickitstory.ae',
  NEXT_PUBLIC_SUPABASE_URL: 'https://lajguozmtissnnfccmej.supabase.co',
  NEXT_PUBLIC_SUPABASE_ANON_KEY: PUBLISHABLE,
  NEXT_PUBLIC_TURNSTILE_SITE_KEY: REAL_TURNSTILE,
  NEXT_PUBLIC_CF_BEACON_TOKEN: 'beacon-fixture',
}

const manifest = { manifestSha256: MANIFEST_SHA, manifestObjectCount: 86 }
const prodReport = {
  manifestSha256: MANIFEST_SHA,
  manifestObjectCount: 86,
  originalsChecked: 86,
  variantsChecked: 200,
  failures: [],
  origin: 'https://media.clickitstory.ae',
  finishedAt: '2026-10-21T10:00:00Z',
}
const prodOptions = { mediaFlag: 'verified', mediaOrigin: 'https://media.clickitstory.ae', verifyReport: prodReport, manifest }

const realConfig = parseJsonc(readFileSync('wrangler.jsonc', 'utf8'))

function prodEnv(fileOver: Record<string, string> = {}, optionsOver: Record<string, unknown> = {}) {
  return buildEnvFor('production', { ...prodFileEnv, ...fileOver }, { ...prodOptions, ...optionsOver }, {})
}

function prodStamp(over: Record<string, unknown> = {}) {
  const stamp = makeStamp({
    target: 'production',
    gitSha: SHA,
    createdAt: '2026-10-21T10:00:00Z',
    env: prodEnv(),
    verifyReportSha256: REPORT_SHA,
  })
  return { ...stamp, ...over }
}

function configWith(mutate: (env: Record<string, any>, top: Record<string, any>) => void) {
  const config = structuredClone(realConfig)
  mutate(config.env.production, config)
  return config
}

function prodInput(over: Record<string, unknown> = {}) {
  return {
    whoami: whoamiOk,
    processEnv: {},
    stamp: prodStamp(),
    headSha: SHA,
    gitStatus: '',
    originBranches: '  origin/claude/phase-03-production-cutover-689a87\n  origin/main\n',
    wranglerConfig: realConfig,
    verifyReport: prodReport,
    verifyReportSha256: REPORT_SHA,
    manifest,
    envFilesPresent: [],
    nextEnvText: EMPTY_NEXT_ENV,
    ...over,
  }
}

function reasonsOf(res: { reasons: string[] }) {
  return res.reasons.join(' | ')
}

// ------------------------------------------------------------ classifySupabaseKey

test('classifySupabaseKey: publishable, secret, legacy JWT, missing and other', () => {
  assert.equal(classifySupabaseKey(PUBLISHABLE), 'publishable')
  assert.equal(classifySupabaseKey(SECRET), 'secret')
  assert.equal(classifySupabaseKey(LEGACY_JWT), 'legacy-jwt')
  assert.equal(classifySupabaseKey(''), 'missing')
  assert.equal(classifySupabaseKey(undefined), 'missing')
  assert.equal(classifySupabaseKey('anon-fixture-value'), 'other')
  assert.equal(classifySupabaseKey('a.b'), 'other')
})

// ------------------------------------------------------------------ buildEnvFor

test('production constants: env file under the Clickit HOME, www site, media host', () => {
  assert.equal(PRODUCTION_ENV_FILE, '/Users/koss/.clickit-cloudflare/clickit.production.env')
  assert.equal(PRODUCTION_SITE_URL, 'https://www.clickitstory.ae')
  assert.equal(PRODUCTION_MEDIA_ORIGIN, 'https://media.clickitstory.ae')
})

test('buildEnvFor production sets www, the media host, the verified flag and clears local values', () => {
  const env = buildEnvFor('production', { ...prodFileEnv, LOCAL_DEV: '1', NEXT_PUBLIC_MEDIA_ALLOW_LOOPBACK: '1' }, prodOptions, {})
  assert.equal(env.NEXT_PUBLIC_SITE_URL, 'https://www.clickitstory.ae')
  assert.equal(env.NEXT_PUBLIC_MEDIA_ORIGIN, 'https://media.clickitstory.ae')
  assert.equal(env.NEXT_PUBLIC_MEDIA_CUTOVER_READY, 'verified')
  assert.equal(env.NEXTJS_ENV, 'production')
  assert.equal(env.LOCAL_DEV, '')
  assert.equal(env.NEXT_PUBLIC_MEDIA_ALLOW_LOOPBACK, '')
  assert.equal(env.NEXT_PUBLIC_SUPABASE_ANON_KEY, PUBLISHABLE)
})

test('buildEnvFor production refuses a site URL that is not exactly https://www.clickitstory.ae', () => {
  for (const site of ['https://clickitstory.ae', 'https://www.clickitstory.ae/', 'http://www.clickitstory.ae', 'https://clickit.clickitstory.workers.dev']) {
    assert.throws(() => prodEnv({ NEXT_PUBLIC_SITE_URL: site }), /SITE_URL/, site)
  }
})

test('buildEnvFor production refuses a media flag other than verified', () => {
  assert.throws(() => prodEnv({}, { mediaFlag: 'off' }), /verified/)
  assert.throws(() => prodEnv({}, { mediaFlag: undefined }), /verified/)
})

test('buildEnvFor production refuses a media origin other than https://media.clickitstory.ae', () => {
  const origin = 'https://clickit-media-r2.clickitstory.workers.dev'
  assert.throws(() => prodEnv({}, { mediaOrigin: origin, verifyReport: { ...prodReport, origin } }), /media\.clickitstory\.ae/)
  assert.throws(() => prodEnv({}, { mediaOrigin: undefined }), /media\.clickitstory\.ae/)
})

test('buildEnvFor production refuses a verify report that fails (failures, other manifest, other origin, missing)', () => {
  assert.throws(() => prodEnv({}, { verifyReport: { ...prodReport, failures: ['x'] } }), /failure/)
  assert.throws(() => prodEnv({}, { verifyReport: { ...prodReport, manifestSha256: 'c'.repeat(64) } }), /manifest/)
  assert.throws(
    () => prodEnv({}, { verifyReport: { ...prodReport, origin: 'https://clickit-media.clickitstory.workers.dev' } }),
    /different media origin/,
  )
  assert.throws(() => prodEnv({}, { verifyReport: null }), /verify report/)
})

test('buildEnvFor production refuses every Supabase key class except publishable', () => {
  for (const key of [LEGACY_JWT, SECRET, '', 'anon-fixture-value']) {
    assert.throws(() => prodEnv({ NEXT_PUBLIC_SUPABASE_ANON_KEY: key }), /publishable|secret|missing/, key.slice(0, 6))
  }
})

test('buildEnvFor refuses an sb_secret_ key in any NEXT_PUBLIC value, for every target', () => {
  const workersdevFile = { ...prodFileEnv, NEXT_PUBLIC_SITE_URL: 'https://clickit.clickitstory.workers.dev' }
  assert.throws(() => buildEnvFor('workersdev', { ...workersdevFile, NEXT_PUBLIC_SUPABASE_ANON_KEY: SECRET }, { mediaFlag: 'off' }, {}), /secret/)
  assert.throws(() => buildEnvFor('preview', { ...prodFileEnv, NEXT_PUBLIC_SUPABASE_ANON_KEY: SECRET }, {}, {}), /secret/)
  assert.throws(() => prodEnv({ NEXT_PUBLIC_CF_BEACON_TOKEN: SECRET }), /secret/)
})

test('buildEnvFor production refuses an empty Web Analytics token', () => {
  assert.throws(() => prodEnv({ NEXT_PUBLIC_CF_BEACON_TOKEN: '' }), /BEACON/)
  assert.throws(() => prodEnv({ NEXT_PUBLIC_CF_BEACON_TOKEN: '   ' }), /BEACON/)
})

test('buildEnvFor production refuses a missing or Cloudflare test Turnstile site key', () => {
  assert.throws(() => prodEnv({ NEXT_PUBLIC_TURNSTILE_SITE_KEY: '' }), /TURNSTILE/)
  assert.throws(() => prodEnv({ NEXT_PUBLIC_TURNSTILE_SITE_KEY: TEST_TURNSTILE }), /TURNSTILE/)
})

test('buildEnvFor production refuses a missing Supabase URL and a VERCEL shell', () => {
  assert.throws(() => prodEnv({ NEXT_PUBLIC_SUPABASE_URL: '' }), /SUPABASE_URL/)
  assert.throws(() => buildEnvFor('production', prodFileEnv, prodOptions, { VERCEL: '1' }), /VERCEL/)
  assert.throws(() => buildEnvFor('production', prodFileEnv, prodOptions, { VERCEL_ENV: 'production' }), /VERCEL/)
})

// -------------------------------------------------------------------- makeStamp

test('makeStamp adds supabaseKeyKind and beaconToken classes, never the values', () => {
  const stamp = prodStamp()
  assert.equal(stamp.target, 'production')
  assert.equal(stamp.supabaseKeyKind, 'publishable')
  assert.equal(stamp.beaconToken, 'set')
  assert.equal(stamp.turnstileSiteKey, 'real')
  assert.equal(stamp.mediaFlag, 'verified')
  assert.equal(stamp.mediaOrigin, 'https://media.clickitstory.ae')
  assert.equal(stamp.verifyReportSha256, REPORT_SHA)
  const text = JSON.stringify(stamp)
  for (const value of [PUBLISHABLE, 'beacon-fixture', REAL_TURNSTILE, 'lajguozmtissnnfccmej']) {
    assert.equal(text.includes(value), false, value)
  }
})

test('makeStamp classifies keys for every target (workers.dev legacy key, preview missing beacon)', () => {
  const workersdev = makeStamp({
    target: 'workersdev',
    gitSha: SHA,
    createdAt: 'now',
    env: { NEXT_PUBLIC_SUPABASE_ANON_KEY: LEGACY_JWT, NEXT_PUBLIC_CF_BEACON_TOKEN: '' },
  })
  assert.equal(workersdev.supabaseKeyKind, 'legacy-jwt')
  assert.equal(workersdev.beaconToken, 'missing')
  assert.equal(JSON.stringify(workersdev).includes(LEGACY_JWT), false)
  assert.equal('verifyReportSha256' in workersdev, false)
})

// ------------------------------------------------------------ checkProductionDeploy

test('checkProductionDeploy passes a full production input against the real wrangler.jsonc', () => {
  const res = checkProductionDeploy(prodInput())
  assert.deepEqual(res.reasons, [])
  assert.equal(res.ok, true)
})

test('PRODUCTION_CRONS is the literal three schedules and equals CRON_EXPRESSIONS_FOR_PHASE_3 (sorted)', () => {
  assert.deepEqual([...PRODUCTION_CRONS], ['0 1 * * *', '0 4 * * 1', '30 1 * * *'])
  assert.deepEqual([...PRODUCTION_CRONS].sort(), [...CRON_EXPRESSIONS_FOR_PHASE_3].sort())
  assert.equal(PRODUCTION_ROUTE, 'www.clickitstory.ae/*')
  assert.equal(PRODUCTION_ZONE_ID, 'd8fa01b24f24653a29a0a56431072dc2')
})

test('checkProductionDeploy refuses env.production crons other than the three schedules', () => {
  for (const crons of [['55 0 * * *'], ['0 1 * * *', '0 4 * * 1'], [...PRODUCTION_CRONS, '* * * * *'], [], ['0 1 * * *', '0 1 * * *', '0 4 * * 1']]) {
    const res = checkProductionDeploy(prodInput({ wranglerConfig: configWith((env) => (env.triggers = { crons })) }))
    assert.match(reasonsOf(res), /env\.production triggers\.crons/, JSON.stringify(crons))
  }
  const missing = checkProductionDeploy(prodInput({ wranglerConfig: configWith((env) => delete env.triggers) }))
  assert.equal(missing.ok, false)
})

test('checkProductionDeploy accepts the three schedules in another order', () => {
  const res = checkProductionDeploy(
    prodInput({ wranglerConfig: configWith((env) => (env.triggers = { crons: ['30 1 * * *', '0 1 * * *', '0 4 * * 1'] })) }),
  )
  assert.deepEqual(res.reasons, [])
})

test('checkProductionDeploy refuses CLEANUP_SUPABASE_ORIGINALS and LOCAL_DEV in env.production vars', () => {
  const cleanup = checkProductionDeploy(prodInput({ wranglerConfig: configWith((env) => (env.vars.CLEANUP_SUPABASE_ORIGINALS = 'off')) }))
  assert.match(reasonsOf(cleanup), /CLEANUP_SUPABASE_ORIGINALS/)
  const local = checkProductionDeploy(prodInput({ wranglerConfig: configWith((env) => (env.vars.LOCAL_DEV = '1')) }))
  assert.match(reasonsOf(local), /LOCAL_DEV/)
})

test('checkProductionDeploy: R2_UPLOAD_SWEEP_DELETE "on" needs --allow-upload-sweep-delete; any other value refused', () => {
  const on = configWith((env) => (env.vars.R2_UPLOAD_SWEEP_DELETE = 'on'))
  assert.match(reasonsOf(checkProductionDeploy(prodInput({ wranglerConfig: on }))), /R2_UPLOAD_SWEEP_DELETE/)
  assert.deepEqual(checkProductionDeploy(prodInput({ wranglerConfig: on, allowUploadSweepDelete: true })).reasons, [])
  const maybe = configWith((env) => (env.vars.R2_UPLOAD_SWEEP_DELETE = 'maybe'))
  assert.equal(checkProductionDeploy(prodInput({ wranglerConfig: maybe })).ok, false)
  assert.equal(checkProductionDeploy(prodInput({ wranglerConfig: maybe, allowUploadSweepDelete: true })).ok, false)
})

test('checkProductionDeploy refuses a missing stamp and a stamp of another target', () => {
  assert.match(reasonsOf(checkProductionDeploy(prodInput({ stamp: null }))), /no production build: run cf:build:production first/)
  for (const target of ['workersdev', 'preview']) {
    assert.match(reasonsOf(checkProductionDeploy(prodInput({ stamp: prodStamp({ target }) }))), /expected production/, target)
  }
})

test('checkProductionDeploy refuses media flag off or a media origin other than media.clickitstory.ae', () => {
  assert.match(reasonsOf(checkProductionDeploy(prodInput({ stamp: prodStamp({ mediaFlag: 'off', mediaOrigin: '' }) }))), /media flag/)
  const workersOrigin = prodStamp({ mediaOrigin: 'https://clickit-media-r2.clickitstory.workers.dev' })
  assert.match(reasonsOf(checkProductionDeploy(prodInput({ stamp: workersOrigin }))), /media\.clickitstory\.ae/)
})

test('checkProductionDeploy refuses a failing verify report passed at deploy', () => {
  const res = checkProductionDeploy(prodInput({ verifyReport: { ...prodReport, failures: ['a.png'] } }))
  assert.match(reasonsOf(res), /failure/)
  assert.equal(checkProductionDeploy(prodInput({ verifyReport: null, verifyReportSha256: null })).ok, false)
})

test('checkProductionDeploy refuses a non-publishable key, a missing beacon token and a test or missing Turnstile key', () => {
  for (const kind of ['legacy-jwt', 'secret', 'missing', 'other', undefined]) {
    assert.match(reasonsOf(checkProductionDeploy(prodInput({ stamp: prodStamp({ supabaseKeyKind: kind }) }))), /publishable/, String(kind))
  }
  assert.match(reasonsOf(checkProductionDeploy(prodInput({ stamp: prodStamp({ beaconToken: 'missing' }) }))), /BEACON|Web Analytics/)
  assert.match(reasonsOf(checkProductionDeploy(prodInput({ stamp: prodStamp({ turnstileSiteKey: 'test' }) }))), /TEST site key/)
  assert.match(reasonsOf(checkProductionDeploy(prodInput({ stamp: prodStamp({ turnstileSiteKey: 'missing' }) }))), /TURNSTILE/)
})

test('checkProductionDeploy refuses loopback, local Supabase and LOCAL_DEV stamps', () => {
  assert.match(reasonsOf(checkProductionDeploy(prodInput({ stamp: prodStamp({ hasLoopback: true }) }))), /loopback/)
  assert.match(reasonsOf(checkProductionDeploy(prodInput({ stamp: prodStamp({ hasLocalSupabase: true }) }))), /55321/)
  assert.match(reasonsOf(checkProductionDeploy(prodInput({ stamp: prodStamp({ localDev: true }) }))), /LOCAL_DEV/)
})

test('checkProductionDeploy refuses a stamp from another commit, a dirty tree and HEAD not in origin/main', () => {
  assert.match(reasonsOf(checkProductionDeploy(prodInput({ headSha: OTHER_SHA }))), /differs from HEAD/)
  assert.match(reasonsOf(checkProductionDeploy(prodInput({ gitStatus: ' M x\n' }))), /dirty/)
  for (const branches of ['  origin/claude/phase-03-production-cutover-689a87\n', '', '  origin/main-old\n', '  origin/HEAD -> origin/main\n']) {
    assert.match(reasonsOf(checkProductionDeploy(prodInput({ originBranches: branches }))), /origin\/main/, branches)
  }
})

test('checkProductionDeploy refuses a missing env.production or a Worker name other than clickit', () => {
  const noEnv = structuredClone(realConfig)
  delete noEnv.env.production
  assert.match(reasonsOf(checkProductionDeploy(prodInput({ wranglerConfig: noEnv }))), /env\.production/)
  const renamed = configWith((env) => (env.name = 'clickit-production'))
  assert.match(reasonsOf(checkProductionDeploy(prodInput({ wranglerConfig: renamed }))), /name/)
  const unnamed = configWith((env) => delete env.name)
  assert.equal(checkProductionDeploy(prodInput({ wranglerConfig: unnamed })).ok, false)
})

test('checkProductionDeploy refuses any route other than the single www route by zone_id', () => {
  const variants = [
    [],
    [{ pattern: 'clickitstory.ae/*', zone_id: PRODUCTION_ZONE_ID }],
    [{ pattern: 'www.clickitstory.ae/*', zone_id: OTHER }],
    [{ pattern: 'www.clickitstory.ae/*', zone_name: 'clickitstory.ae' }],
    [{ pattern: 'www.clickitstory.ae', custom_domain: true }],
    [{ pattern: 'www.clickitstory.ae/*', zone_id: PRODUCTION_ZONE_ID }, { pattern: 'media.clickitstory.ae/*', zone_id: PRODUCTION_ZONE_ID }],
  ]
  for (const routes of variants) {
    const res = checkProductionDeploy(prodInput({ wranglerConfig: configWith((env) => (env.routes = routes)) }))
    assert.match(reasonsOf(res), /route/, JSON.stringify(routes))
  }
  const single = configWith((env) => (env.route = 'www.clickitstory.ae/*'))
  assert.equal(checkProductionDeploy(prodInput({ wranglerConfig: single })).ok, false)
})

test('checkProductionDeploy refuses top-level crons, an all-zero d1 id in env.production and a foreign account_id', () => {
  const topCrons = configWith((_env, top) => (top.triggers = { crons: ['0 1 * * *'] }))
  assert.match(reasonsOf(checkProductionDeploy(prodInput({ wranglerConfig: topCrons }))), /top-level triggers\.crons/)
  const zero = configWith((env) => (env.d1_databases = [{ binding: 'NEXT_TAG_CACHE_D1', database_id: '00000000-0000-0000-0000-000000000000' }]))
  assert.match(reasonsOf(checkProductionDeploy(prodInput({ wranglerConfig: zero }))), /all-zero/)
  const noD1 = configWith((env) => (env.d1_databases = []))
  assert.match(reasonsOf(checkProductionDeploy(prodInput({ wranglerConfig: noD1 }))), /d1/)
  const foreign = configWith((_env, top) => (top.account_id = OTHER))
  assert.match(reasonsOf(checkProductionDeploy(prodInput({ wranglerConfig: foreign }))), /account_id/)
})

test('checkProductionDeploy refuses a whoami with another account, no whoami, an API token or VERCEL', () => {
  assert.match(reasonsOf(checkProductionDeploy(prodInput({ whoami: whoamiOther }))), /other than ClickitStory/)
  assert.match(reasonsOf(checkProductionDeploy(prodInput({ whoami: null }))), /ClickitStory/)
  assert.equal(checkProductionDeploy(prodInput({ processEnv: { CLOUDFLARE_API_TOKEN: 'x' } })).ok, false)
  assert.equal(checkProductionDeploy(prodInput({ processEnv: { VERCEL: '1' } })).ok, false)
})

test('checkProductionDeploy refuses folded .env files and a next-env module carrying values', () => {
  assert.match(reasonsOf(checkProductionDeploy(prodInput({ envFilesPresent: ['.env.local'] }))), /\.env\.local/)
  assert.equal(checkProductionDeploy(prodInput({ nextEnvText: null })).ok, false)
})

// ---------------------------------------------------------------- offline dry run

test('checkProductionDeploy offline: whoami null skips only the account reason, reported as skipped', () => {
  const res = checkProductionDeploy(prodInput({ whoami: null, offline: true }))
  assert.deepEqual(res.reasons, [])
  assert.equal(res.ok, true)
  assert.ok(res.notes.includes('account check: skipped (offline)'))
  const others = checkProductionDeploy(prodInput({ whoami: null, offline: true, gitStatus: ' M x\n', processEnv: { CLOUDFLARE_API_TOKEN: 'x' } }))
  assert.match(reasonsOf(others), /dirty/)
  assert.match(reasonsOf(others), /CLOUDFLARE_API_TOKEN/)
})

test('checkDeploy offline: whoami null skips only the account reason; offline false keeps it', () => {
  const env = buildEnvFor(
    'workersdev',
    { ...prodFileEnv, NEXT_PUBLIC_SITE_URL: 'https://clickit.clickitstory.workers.dev' },
    { mediaFlag: 'off' },
    {},
  )
  const input = {
    whoami: null,
    processEnv: {},
    stamp: makeStamp({ target: 'workersdev', gitSha: SHA, createdAt: 'now', env }),
    headSha: SHA,
    gitStatus: '',
    originBranches: '  origin/main\n',
    wranglerConfig: realConfig,
    envFilesPresent: [],
    nextEnvText: EMPTY_NEXT_ENV,
  }
  const offline = checkDeploy({ ...input, offline: true })
  assert.deepEqual(offline.reasons, [])
  assert.ok(offline.notes.includes('account check: skipped (offline)'))
  const online = checkDeploy({ ...input, offline: false })
  assert.match(reasonsOf(online), /ClickitStory/)
})

// ------------------------------------------------------------- checkTargetSwitch (D-18)

test('checkTargetSwitch allows production always and workers.dev when no production deploy is last', () => {
  assert.equal(checkTargetSwitch({ lastDeploy: { target: 'workersdev' }, target: 'production' }).ok, true)
  assert.equal(checkTargetSwitch({ lastDeploy: { target: 'production' }, target: 'production' }).ok, true)
  assert.equal(checkTargetSwitch({ lastDeploy: null, target: 'workersdev' }).ok, true)
  assert.equal(checkTargetSwitch({ lastDeploy: { target: 'workersdev' }, target: 'workersdev' }).ok, true)
})

test('checkTargetSwitch refuses workers.dev after a production deploy unless the reason has 15+ characters', () => {
  const last = { target: 'production', gitSha: SHA, deployedAt: '2026-10-21T10:00:00Z' }
  const none = checkTargetSwitch({ lastDeploy: last, target: 'workersdev' })
  assert.equal(none.ok, false)
  assert.match(reasonsOf(none), /override-production-reason/)
  assert.equal(checkTargetSwitch({ lastDeploy: last, target: 'workersdev', overrideReason: 'too short' }).ok, false)
  assert.equal(checkTargetSwitch({ lastDeploy: last, target: 'workersdev', overrideReason: `   ${'x'.repeat(14)}   ` }).ok, false)
  const ok = checkTargetSwitch({ lastDeploy: last, target: 'workersdev', overrideReason: 'Koss: rollback test 2026-10-21' })
  assert.equal(ok.ok, true)
  assert.equal(ok.overridden, true)
})

test('checkTargetSwitch fails closed on an unknown last target or an unknown deploy target', () => {
  assert.equal(checkTargetSwitch({ lastDeploy: { target: 'unreadable' }, target: 'workersdev' }).ok, false)
  assert.equal(checkTargetSwitch({ lastDeploy: null, target: 'media' }).ok, false)
})

// -------------------------------------------------------- checkMediaDeploy (r2 env, D-08)

const SUPA = { SUPABASE_URL: 'https://lajguozmtissnnfccmej.supabase.co' }
const MEDIA_ROUTE = { pattern: 'media.clickitstory.ae', custom_domain: true }
const mediaConfig = {
  name: 'clickit-media',
  account_id: CLICKIT,
  triggers: { crons: [] },
  vars: { ...SUPA },
  routes: [MEDIA_ROUTE],
  env: {
    'supabase-only': { name: 'clickit-media', routes: [MEDIA_ROUTE], vars: { ...SUPA } } as Record<string, unknown>,
    r2: {
      name: 'clickit-media',
      routes: [MEDIA_ROUTE],
      vars: { ...SUPA },
      r2_buckets: [{ binding: 'MEDIA_BUCKET', bucket_name: 'clickit-media' }],
    } as Record<string, unknown>,
  },
}

function mediaInput(env: string, mutate?: (config: any) => void) {
  const config = structuredClone(mediaConfig) as any
  mutate?.(config)
  return { whoami: whoamiOk, processEnv: {}, gitStatus: '', wranglerConfig: config, env }
}

test('checkMediaDeploy accepts env r2 and supabase-only with the media.clickitstory.ae custom domain', () => {
  assert.deepEqual(checkMediaDeploy(mediaInput('r2')).reasons, [])
  assert.deepEqual(checkMediaDeploy(mediaInput('supabase-only')).reasons, [])
  const real = parseJsonc(readFileSync('workers/media/wrangler.jsonc', 'utf8'))
  for (const env of ['r2', 'supabase-only']) {
    assert.deepEqual(checkMediaDeploy({ ...mediaInput(env), wranglerConfig: real }).reasons, [], env)
  }
})

test('checkMediaDeploy r2 and supabase-only: routes must be exactly the media custom domain', () => {
  for (const env of ['r2', 'supabase-only']) {
    for (const routes of [[], [{ pattern: 'media.clickitstory.ae/*', zone_id: PRODUCTION_ZONE_ID }], [{ ...MEDIA_ROUTE, custom_domain: false }], [MEDIA_ROUTE, MEDIA_ROUTE]]) {
      const res = checkMediaDeploy(mediaInput(env, (c) => (c.env[env].routes = routes)))
      assert.match(reasonsOf(res), /routes/, `${env} ${JSON.stringify(routes)}`)
    }
    const single = checkMediaDeploy(mediaInput(env, (c) => (c.env[env].route = 'media.clickitstory.ae/*')))
    assert.equal(single.ok, false, env)
  }
})

test('checkMediaDeploy r2: inherited top-level routes count (the env inherits them in wrangler)', () => {
  const inherit = checkMediaDeploy(mediaInput('r2', (c) => delete c.env.r2.routes))
  assert.deepEqual(inherit.reasons, [])
  const badTop = checkMediaDeploy(
    mediaInput('r2', (c) => {
      delete c.env.r2.routes
      c.routes = [{ pattern: 'cdn.example.com', custom_domain: true }]
    }),
  )
  assert.match(reasonsOf(badTop), /routes/)
})

test('checkMediaDeploy r2: refuses without MEDIA_BUCKET, with extra vars or with crons', () => {
  assert.match(reasonsOf(checkMediaDeploy(mediaInput('r2', (c) => (c.env.r2.r2_buckets = [])))), /MEDIA_BUCKET/)
  assert.match(reasonsOf(checkMediaDeploy(mediaInput('r2', (c) => (c.env.r2.vars.EXTRA = '1')))), /unexpected var EXTRA/)
  assert.equal(checkMediaDeploy(mediaInput('r2', (c) => (c.env.r2.triggers = { crons: ['0 1 * * *'] }))).ok, false)
})

test('checkMediaDeploy refuses any env name outside supabase-only, r2 and r2-workersdev', () => {
  for (const env of ['production', '', 'R2', 'r2 ']) {
    assert.equal(checkMediaDeploy(mediaInput(env)).ok, false, JSON.stringify(env))
  }
})
