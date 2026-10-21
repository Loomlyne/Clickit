import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  checkDeploy,
  checkMediaDeploy,
  checkVerifyReport,
  isAllowedMediaOrigin,
  parseJsonc,
} from '../../scripts/cf/deploy-guard.mjs'
import { buildEnvFor, classifyTurnstileSiteKey, makeStamp, parseEnvFile } from '../../scripts/cf/build-target.mjs'

const CLICKIT = 'e329b099b6e4272fc0915a99832e47fe'
const OTHER = '0123456789abcdef0123456789abcdef'
const SHA = '1111111111111111111111111111111111111111'
const MANIFEST_SHA = 'a'.repeat(64)
const MEDIA_ORIGIN = 'https://clickit-media.clickit-sub.workers.dev'

const whoamiOk = `Getting User settings...\nAccount Name | Account ID\nClickitStory | ${CLICKIT}`
const whoamiOther = `${whoamiOk}\nVamos | ${OTHER}`

const fileEnv = {
  NEXT_PUBLIC_SITE_URL: 'https://clickit.clickit-sub.workers.dev',
  NEXT_PUBLIC_SUPABASE_URL: 'https://lajguozmtissnnfccmej.supabase.co',
  NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon-fixture-value',
  NEXT_PUBLIC_TURNSTILE_SITE_KEY: '0x4AAAAAAAfixture-not-a-real-key',
  NEXT_PUBLIC_CF_BEACON_TOKEN: '',
}

// What OpenNext writes to .open-next/cloudflare/next-env.mjs when no .env file exists.
const EMPTY_NEXT_ENV = 'export const production = {};\nexport const development = {};\nexport const test = {};\n'

const manifest = { manifestSha256: MANIFEST_SHA, manifestObjectCount: 86 }
const goodReport = {
  manifestSha256: MANIFEST_SHA,
  manifestObjectCount: 86,
  originalsChecked: 86,
  variantsChecked: 200,
  failures: [],
  origin: MEDIA_ORIGIN,
  finishedAt: '2026-10-20T10:00:00Z',
}

const appConfig = {
  account_id: CLICKIT,
  triggers: { crons: [] },
  d1_databases: [{ binding: 'NEXT_TAG_CACHE_D1', database_id: '2f1c9a52-0000-4000-8000-123456789abc' }],
  vars: { CLOUDFLARE_ACCOUNT_ID: CLICKIT },
}

function workersdevStamp(over: Record<string, unknown> = {}) {
  const env = buildEnvFor('workersdev', fileEnv, { mediaFlag: 'off' }, {})
  return { ...makeStamp({ target: 'workersdev', gitSha: SHA, createdAt: '2026-10-20T10:00:00Z', env }), ...over }
}

function deployInput(over: Record<string, unknown> = {}) {
  return {
    whoami: whoamiOk,
    processEnv: {},
    stamp: workersdevStamp(),
    headSha: SHA,
    gitStatus: '',
    originBranches: '  origin/claude/phase-02-execute-19d86a\n',
    wranglerConfig: appConfig,
    verifyReport: null,
    manifest: null,
    envFilesPresent: [],
    nextEnvText: EMPTY_NEXT_ENV,
    ...over,
  }
}

function reasonsOf(res: { ok: boolean; reasons: string[] }) {
  return res.reasons.join(' | ')
}

// ---------------------------------------------------------------- parseJsonc

test('parseJsonc strips line and block comments and trailing commas', () => {
  const parsed = parseJsonc(`{
    // a comment
    "a": "x // not a comment", /* block */
    "b": [1, 2,],
    "c": { "d": true, },
  }`)
  assert.deepEqual(parsed, { a: 'x // not a comment', b: [1, 2], c: { d: true } })
})

test('parseJsonc keeps an escaped quote inside a string', () => {
  assert.deepEqual(parseJsonc('{"a": "q\\" // still string"}'), { a: 'q" // still string' })
})

// ----------------------------------------------------------- checkVerifyReport

test('checkVerifyReport passes for a matching report', () => {
  assert.equal(checkVerifyReport(goodReport, manifest).ok, true)
})

test('checkVerifyReport refuses a report with failures', () => {
  const res = checkVerifyReport({ ...goodReport, failures: ['show-artwork/a.png'] }, manifest)
  assert.equal(res.ok, false)
  assert.match(reasonsOf(res), /failure/)
})

test('checkVerifyReport refuses a different manifest hash', () => {
  const res = checkVerifyReport({ ...goodReport, manifestSha256: 'b'.repeat(64) }, manifest)
  assert.equal(res.ok, false)
  assert.match(reasonsOf(res), /manifest/)
})

test('checkVerifyReport refuses an object count mismatch', () => {
  const res = checkVerifyReport({ ...goodReport, originalsChecked: 85 }, manifest)
  assert.equal(res.ok, false)
  assert.match(reasonsOf(res), /count/)
})

test('checkVerifyReport refuses a manifest count that differs from the report', () => {
  const res = checkVerifyReport({ ...goodReport, manifestObjectCount: 90, originalsChecked: 90 }, manifest)
  assert.equal(res.ok, false)
})

test('checkVerifyReport refuses a missing report or manifest', () => {
  assert.equal(checkVerifyReport(null, manifest).ok, false)
  assert.equal(checkVerifyReport(goodReport, null).ok, false)
})

test('checkVerifyReport refuses an http origin and a foreign workers.dev name', () => {
  assert.equal(checkVerifyReport({ ...goodReport, origin: 'http://clickit-media.x.workers.dev' }, manifest).ok, false)
  assert.equal(checkVerifyReport({ ...goodReport, origin: 'https://clickit.x.workers.dev' }, manifest).ok, false)
})

// --------------------------------------------------------------- buildEnvFor

test('buildEnvFor preview never sets the media cutover flag', () => {
  const env = buildEnvFor('preview', { ...fileEnv, NEXT_PUBLIC_MEDIA_CUTOVER_READY: 'verified' }, {}, {})
  assert.equal('NEXT_PUBLIC_MEDIA_CUTOVER_READY' in env, false)
  assert.equal(env.NEXT_PUBLIC_MEDIA_ALLOW_LOOPBACK, '1')
  assert.equal(env.NEXT_PUBLIC_MEDIA_ORIGIN, 'http://127.0.0.1:8789')
  assert.equal(env.CSP_UPGRADE_INSECURE, 'false')
})

test('buildEnvFor workersdev with flag off sets flag and origin to empty', () => {
  const env = buildEnvFor('workersdev', fileEnv, { mediaFlag: 'off' }, {})
  assert.equal(env.NEXT_PUBLIC_MEDIA_CUTOVER_READY, '')
  assert.equal(env.NEXT_PUBLIC_MEDIA_ORIGIN, '')
  assert.equal(env.NEXT_PUBLIC_MEDIA_ALLOW_LOOPBACK, '')
  assert.equal(env.LOCAL_DEV, '')
})

test('buildEnvFor workersdev ignores LOCAL_DEV and loopback allowance from the env file', () => {
  const env = buildEnvFor(
    'workersdev',
    { ...fileEnv, LOCAL_DEV: '1', NEXT_PUBLIC_MEDIA_ALLOW_LOOPBACK: '1' },
    { mediaFlag: 'off' },
    {},
  )
  assert.equal(env.LOCAL_DEV, '')
  assert.equal(env.NEXT_PUBLIC_MEDIA_ALLOW_LOOPBACK, '')
})

test('buildEnvFor workersdev verified sets flag and origin when the report passes', () => {
  const env = buildEnvFor(
    'workersdev',
    fileEnv,
    { mediaFlag: 'verified', mediaOrigin: MEDIA_ORIGIN, verifyReport: goodReport, manifest },
    {},
  )
  assert.equal(env.NEXT_PUBLIC_MEDIA_CUTOVER_READY, 'verified')
  assert.equal(env.NEXT_PUBLIC_MEDIA_ORIGIN, MEDIA_ORIGIN)
})

test('buildEnvFor workersdev verified throws for an http origin', () => {
  assert.throws(() =>
    buildEnvFor(
      'workersdev',
      fileEnv,
      { mediaFlag: 'verified', mediaOrigin: 'http://clickit-media.x.workers.dev', verifyReport: goodReport, manifest },
      {},
    ),
  )
})

test('buildEnvFor workersdev verified throws for a workers.dev origin not named clickit-media', () => {
  assert.throws(() =>
    buildEnvFor(
      'workersdev',
      fileEnv,
      { mediaFlag: 'verified', mediaOrigin: 'https://clickit.x.workers.dev', verifyReport: goodReport, manifest },
      {},
    ),
  )
})

test('buildEnvFor workersdev verified throws for a report with failures, other manifest or count mismatch', () => {
  const base = { mediaFlag: 'verified', mediaOrigin: MEDIA_ORIGIN, manifest }
  assert.throws(() => buildEnvFor('workersdev', fileEnv, { ...base, verifyReport: { ...goodReport, failures: ['x'] } }, {}))
  assert.throws(() =>
    buildEnvFor('workersdev', fileEnv, { ...base, verifyReport: { ...goodReport, manifestSha256: 'c'.repeat(64) } }, {}),
  )
  assert.throws(() => buildEnvFor('workersdev', fileEnv, { ...base, verifyReport: { ...goodReport, originalsChecked: 1 } }, {}))
})

test('buildEnvFor workersdev verified throws when the report was made against another origin', () => {
  assert.throws(() =>
    buildEnvFor(
      'workersdev',
      fileEnv,
      {
        mediaFlag: 'verified',
        mediaOrigin: 'https://clickit-media.other-sub.workers.dev',
        verifyReport: goodReport,
        manifest,
      },
      {},
    ),
  )
})

test('buildEnvFor refuses when VERCEL or VERCEL_ENV is set, for every target', () => {
  assert.throws(() => buildEnvFor('workersdev', fileEnv, { mediaFlag: 'off' }, { VERCEL: '1' }))
  assert.throws(() => buildEnvFor('workersdev', fileEnv, { mediaFlag: 'off' }, { VERCEL_ENV: 'production' }))
  assert.throws(() => buildEnvFor('preview', fileEnv, {}, { VERCEL: '1' }))
})

test('buildEnvFor workersdev throws for each missing required public value', () => {
  for (const name of ['NEXT_PUBLIC_SITE_URL', 'NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY']) {
    const partial: Record<string, string> = { ...fileEnv }
    delete partial[name]
    assert.throws(() => buildEnvFor('workersdev', partial, { mediaFlag: 'off' }, {}), new RegExp(name))
  }
})

test('buildEnvFor workersdev refuses a site URL that is not https workers.dev or clickitstory.ae', () => {
  for (const url of ['http://clickit.x.workers.dev', 'https://example.com', 'http://127.0.0.1:8787', 'https://evilclickitstory.ae']) {
    assert.throws(() => buildEnvFor('workersdev', { ...fileEnv, NEXT_PUBLIC_SITE_URL: url }, { mediaFlag: 'off' }, {}))
  }
  assert.doesNotThrow(() =>
    buildEnvFor('workersdev', { ...fileEnv, NEXT_PUBLIC_SITE_URL: 'https://www.clickitstory.ae' }, { mediaFlag: 'off' }, {}),
  )
})

test('buildEnvFor refuses an unknown target and an unknown media flag', () => {
  assert.throws(() => buildEnvFor('production', fileEnv, {}, {}))
  assert.throws(() => buildEnvFor('workersdev', fileEnv, { mediaFlag: 'on' }, {}))
})

test('parseEnvFile reads KEY=VALUE, quotes, comments and export prefixes', () => {
  const parsed = parseEnvFile(`# comment\nA=1\nexport B="two words"\nC='x'\n\nD=\nbad line\n`)
  assert.deepEqual(parsed, { A: '1', B: 'two words', C: 'x', D: '' })
})

// ----------------------------------------------------------------- makeStamp

test('makeStamp records target, sha, flags and hashes and never a raw value', () => {
  const env = buildEnvFor('workersdev', fileEnv, { mediaFlag: 'off' }, {})
  const stamp = makeStamp({ target: 'workersdev', gitSha: SHA, createdAt: '2026-10-20T10:00:00Z', env })
  assert.equal(stamp.target, 'workersdev')
  assert.equal(stamp.gitSha, SHA)
  assert.equal(stamp.mediaFlag, 'off')
  assert.equal(stamp.hasLoopback, false)
  assert.equal(stamp.hasLocalSupabase, false)
  assert.equal(stamp.localDev, false)
  assert.match(stamp.publicHashes.NEXT_PUBLIC_SUPABASE_ANON_KEY, /^[0-9a-f]{64}$/)
  const text = JSON.stringify(stamp)
  assert.equal(text.includes('anon-fixture-value'), false)
  assert.equal(text.includes('lajguozmtissnnfccmej'), false)
  assert.equal(text.includes('clickit-sub.workers.dev'), false)
})

test('makeStamp flags loopback hosts, local Supabase and LOCAL_DEV', () => {
  for (const value of ['http://127.0.0.1:8787', 'http://localhost:3000', 'http://0.0.0.0:1', 'http://[::1]:3000']) {
    const stamp = makeStamp({ target: 'preview', gitSha: SHA, createdAt: 'now', env: { NEXT_PUBLIC_X: value } })
    assert.equal(stamp.hasLoopback, true, value)
  }
  const local = makeStamp({
    target: 'preview',
    gitSha: SHA,
    createdAt: 'now',
    env: { NEXT_PUBLIC_SUPABASE_URL: 'http://192.168.1.2:55321', LOCAL_DEV: '1' },
  })
  assert.equal(local.hasLocalSupabase, true)
  assert.equal(local.localDev, true)
})

test('makeStamp for a verified build keeps the media origin and flag', () => {
  const env = buildEnvFor(
    'workersdev',
    fileEnv,
    { mediaFlag: 'verified', mediaOrigin: MEDIA_ORIGIN, verifyReport: goodReport, manifest },
    {},
  )
  const stamp = makeStamp({ target: 'workersdev', gitSha: SHA, createdAt: 'now', env })
  assert.equal(stamp.mediaFlag, 'verified')
  assert.equal(stamp.mediaOrigin, MEDIA_ORIGIN)
})

test('makeStamp for the preview build is stamped preview with loopback', () => {
  const env = buildEnvFor('preview', { ...fileEnv, NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:55321', LOCAL_DEV: '1' }, {}, {})
  const stamp = makeStamp({ target: 'preview', gitSha: SHA, createdAt: 'now', env })
  assert.equal(stamp.target, 'preview')
  assert.equal(stamp.hasLoopback, true)
  assert.equal(stamp.hasLocalSupabase, true)
  assert.equal(stamp.localDev, true)
  assert.equal(stamp.mediaFlag, 'off')
})

// --------------------------------------------------------------- checkDeploy

test('checkDeploy passes for a fully valid input', () => {
  const res = checkDeploy(deployInput())
  assert.deepEqual(res.reasons, [])
  assert.equal(res.ok, true)
})

test('checkDeploy passes a verified build with a passing report', () => {
  const env = buildEnvFor(
    'workersdev',
    fileEnv,
    { mediaFlag: 'verified', mediaOrigin: MEDIA_ORIGIN, verifyReport: goodReport, manifest },
    {},
  )
  const stamp = makeStamp({ target: 'workersdev', gitSha: SHA, createdAt: 'now', env })
  assert.equal(checkDeploy(deployInput({ stamp, verifyReport: goodReport, manifest })).ok, true)
})

test('checkDeploy refuses a verified stamp without a passing verify report', () => {
  const env = buildEnvFor(
    'workersdev',
    fileEnv,
    { mediaFlag: 'verified', mediaOrigin: MEDIA_ORIGIN, verifyReport: goodReport, manifest },
    {},
  )
  const stamp = makeStamp({ target: 'workersdev', gitSha: SHA, createdAt: 'now', env })
  assert.equal(checkDeploy(deployInput({ stamp })).ok, false)
  assert.equal(
    checkDeploy(deployInput({ stamp, verifyReport: { ...goodReport, failures: ['x'] }, manifest })).ok,
    false,
  )
})

test('checkDeploy refuses a whoami with another account', () => {
  const res = checkDeploy(deployInput({ whoami: whoamiOther }))
  assert.equal(res.ok, false)
  assert.match(reasonsOf(res), /other than ClickitStory/)
})

test('checkDeploy refuses a whoami without the ClickitStory account', () => {
  assert.equal(checkDeploy(deployInput({ whoami: 'You are not authenticated.' })).ok, false)
})

test('checkDeploy refuses when CLOUDFLARE_API_TOKEN is set', () => {
  const res = checkDeploy(deployInput({ processEnv: { CLOUDFLARE_API_TOKEN: 'x' } }))
  assert.equal(res.ok, false)
  assert.match(reasonsOf(res), /CLOUDFLARE_API_TOKEN/)
})

test('checkDeploy refuses when VERCEL is set in the deploy shell', () => {
  assert.equal(checkDeploy(deployInput({ processEnv: { VERCEL: '1' } })).ok, false)
})

test('checkDeploy refuses a missing stamp', () => {
  const res = checkDeploy(deployInput({ stamp: null }))
  assert.equal(res.ok, false)
  assert.match(reasonsOf(res), /stamp missing/)
})

test('checkDeploy refuses a preview stamp and names the reason', () => {
  const res = checkDeploy(deployInput({ stamp: workersdevStamp({ target: 'preview' }) }))
  assert.equal(res.ok, false)
  assert.match(reasonsOf(res), /stamp target is preview/)
})

test('checkDeploy refuses loopback, local Supabase and LOCAL_DEV stamps', () => {
  assert.match(reasonsOf(checkDeploy(deployInput({ stamp: workersdevStamp({ hasLoopback: true }) }))), /loopback/)
  assert.match(reasonsOf(checkDeploy(deployInput({ stamp: workersdevStamp({ hasLocalSupabase: true }) }))), /local Supabase/)
  assert.match(reasonsOf(checkDeploy(deployInput({ stamp: workersdevStamp({ localDev: true }) }))), /LOCAL_DEV/)
})

test('classifyTurnstileSiteKey tells missing, Cloudflare test keys and real keys apart', () => {
  assert.equal(classifyTurnstileSiteKey(''), 'missing')
  assert.equal(classifyTurnstileSiteKey('   '), 'missing')
  assert.equal(classifyTurnstileSiteKey(undefined), 'missing')
  for (const key of [
    '1x00000000000000000000AA',
    '2x00000000000000000000AB',
    '3x00000000000000000000FF',
    '1x00000000000000000000BB',
    '2x00000000000000000000BB',
  ]) {
    assert.equal(classifyTurnstileSiteKey(key), 'test', key)
  }
  assert.equal(classifyTurnstileSiteKey('0x4AAAAAAAfixture-not-a-real-key'), 'real')
})

test('makeStamp records the site key class and never the key', () => {
  const env = buildEnvFor('workersdev', fileEnv, { mediaFlag: 'off' }, {})
  const stamp = makeStamp({ target: 'workersdev', gitSha: SHA, createdAt: 'now', env })
  assert.equal(stamp.turnstileSiteKey, 'real')
  assert.equal(JSON.stringify(stamp).includes('fixture-not-a-real-key'), false)
  const test = makeStamp({
    target: 'preview',
    gitSha: SHA,
    createdAt: 'now',
    env: { NEXT_PUBLIC_TURNSTILE_SITE_KEY: '1x00000000000000000000AA' },
  })
  assert.equal(test.turnstileSiteKey, 'test')
})

test('checkDeploy accepts a workersdev stamp with a real site key', () => {
  assert.equal(checkDeploy(deployInput()).ok, true)
})

test('checkDeploy refuses a Cloudflare test site key and a missing site key', () => {
  const testKey = checkDeploy(deployInput({ stamp: workersdevStamp({ turnstileSiteKey: 'test' }) }))
  assert.equal(testKey.ok, false)
  assert.match(reasonsOf(testKey), /TEST site key/)
  const missing = checkDeploy(deployInput({ stamp: workersdevStamp({ turnstileSiteKey: 'missing' }) }))
  assert.equal(missing.ok, false)
  assert.match(reasonsOf(missing), /no NEXT_PUBLIC_TURNSTILE_SITE_KEY/)
  // An older stamp without the field is refused too (fail closed).
  const old = workersdevStamp()
  delete (old as Record<string, unknown>).turnstileSiteKey
  assert.equal(checkDeploy(deployInput({ stamp: old })).ok, false)
})

test('checkDeploy refuses a stamp from another commit', () => {
  const res = checkDeploy(deployInput({ stamp: workersdevStamp({ gitSha: '2'.repeat(40) }) }))
  assert.equal(res.ok, false)
  assert.match(reasonsOf(res), /stamp commit/)
})

test('checkDeploy refuses a dirty tree', () => {
  const res = checkDeploy(deployInput({ gitStatus: ' M src/app/page.tsx\n' }))
  assert.equal(res.ok, false)
  assert.match(reasonsOf(res), /dirty/)
})

test('checkDeploy refuses a HEAD that is not on any origin branch', () => {
  assert.equal(checkDeploy(deployInput({ originBranches: '' })).ok, false)
  assert.equal(checkDeploy(deployInput({ originBranches: '  origin/HEAD -> origin/main\n' })).ok, false)
})

test('checkDeploy refuses a wrangler account_id that is not ClickitStory', () => {
  const res = checkDeploy(deployInput({ wranglerConfig: { ...appConfig, account_id: OTHER } }))
  assert.equal(res.ok, false)
  assert.match(reasonsOf(res), /account_id/)
})

test('checkDeploy refuses an all-zero D1 id and names the reason', () => {
  const config = { ...appConfig, d1_databases: [{ binding: 'X', database_id: '00000000-0000-0000-0000-000000000000' }] }
  const res = checkDeploy(deployInput({ wranglerConfig: config }))
  assert.equal(res.ok, false)
  assert.match(reasonsOf(res), /d1 database_id is the all-zero placeholder/)
})

test('checkDeploy refuses non-empty or missing cron triggers', () => {
  assert.match(
    reasonsOf(checkDeploy(deployInput({ wranglerConfig: { ...appConfig, triggers: { crons: ['0 3 * * *'] } } }))),
    /crons/,
  )
  const { triggers: _drop, ...noTriggers } = appConfig
  void _drop
  assert.equal(checkDeploy(deployInput({ wranglerConfig: noTriggers })).ok, false)
})

test('checkDeploy refuses LOCAL_DEV in wrangler vars', () => {
  const res = checkDeploy(deployInput({ wranglerConfig: { ...appConfig, vars: { LOCAL_DEV: '1' } } }))
  assert.equal(res.ok, false)
  assert.match(reasonsOf(res), /LOCAL_DEV/)
})

// R2_UPLOAD_SWEEP_DELETE: the weekly sweep deletes unfinalised R2 uploads only when it is
// exactly "on", and the guard refuses to ship "on" unless the deploy names the flag.
const sweepVars = (value: unknown) => ({ ...appConfig, vars: { ...appConfig.vars, R2_UPLOAD_SWEEP_DELETE: value } })

test('checkDeploy passes R2_UPLOAD_SWEEP_DELETE "off" or absent', () => {
  assert.equal(checkDeploy(deployInput({ wranglerConfig: sweepVars('off') })).ok, true)
  assert.equal(checkDeploy(deployInput()).ok, true)
})

test('checkDeploy refuses R2_UPLOAD_SWEEP_DELETE "on" without --allow-upload-sweep-delete', () => {
  const res = checkDeploy(deployInput({ wranglerConfig: sweepVars('on') }))
  assert.equal(res.ok, false)
  assert.match(reasonsOf(res), /R2_UPLOAD_SWEEP_DELETE/)
  assert.match(reasonsOf(res), /--allow-upload-sweep-delete/)
  assert.equal(checkDeploy(deployInput({ wranglerConfig: sweepVars('on'), allowUploadSweepDelete: false })).ok, false)
  assert.equal(checkDeploy(deployInput({ wranglerConfig: sweepVars('on'), allowUploadSweepDelete: 'yes' })).ok, false)
})

test('checkDeploy passes R2_UPLOAD_SWEEP_DELETE "on" only with allowUploadSweepDelete true', () => {
  assert.equal(checkDeploy(deployInput({ wranglerConfig: sweepVars('on'), allowUploadSweepDelete: true })).ok, true)
})

test('checkDeploy refuses any other R2_UPLOAD_SWEEP_DELETE value, even with the deploy flag', () => {
  for (const value of ['ON', 'On', 'true', '1', '', ' on', 1, true]) {
    const res = checkDeploy(deployInput({ wranglerConfig: sweepVars(value), allowUploadSweepDelete: true }))
    assert.equal(res.ok, false, String(value))
    assert.match(reasonsOf(res), /R2_UPLOAD_SWEEP_DELETE/)
  }
})

test('checkDeploy passes the real wrangler.jsonc sweep flag (off)', () => {
  const real = parseJsonc(readFileSync('wrangler.jsonc', 'utf8'))
  assert.equal(real.vars.R2_UPLOAD_SWEEP_DELETE, 'off')
  assert.equal(checkDeploy(deployInput({ wranglerConfig: { ...appConfig, vars: real.vars } })).ok, true)
})

test('deploy.mjs passes --allow-upload-sweep-delete to the guard and warns loudly when it ships "on"', () => {
  const src = readFileSync('scripts/cf/deploy.mjs', 'utf8')
  assert.match(src, /allowUploadSweepDelete: argv\.includes\('--allow-upload-sweep-delete'\)/)
  assert.match(src, /R2_UPLOAD_SWEEP_DELETE/)
})

test('checkDeploy collects every reason, not only the first', () => {
  const res = checkDeploy(
    deployInput({
      stamp: workersdevStamp({ target: 'preview' }),
      wranglerConfig: { ...appConfig, d1_databases: [{ binding: 'X', database_id: '00000000-0000-0000-0000-000000000000' }] },
      gitStatus: ' M a\n',
    }),
  )
  assert.ok(res.reasons.length >= 3)
})

// ------------------------------------------------------------ checkMediaDeploy

// Same shape as workers/media/wrangler.jsonc on main since job D (2026-10-20): no R2
// binding at the top level or in supabase-only; env r2 is the only R2-first config.
const SUPA = { SUPABASE_URL: 'https://lajguozmtissnnfccmej.supabase.co' }
const mediaConfig = {
  name: 'clickit-media',
  account_id: CLICKIT,
  triggers: { crons: [] },
  vars: { ...SUPA },
  routes: [{ pattern: 'media.clickitstory.ae', custom_domain: true }],
  env: {
    'supabase-only': { name: 'clickit-media', vars: { ...SUPA } } as Record<string, unknown>,
    r2: {
      name: 'clickit-media',
      vars: { ...SUPA },
      r2_buckets: [{ binding: 'MEDIA_BUCKET', bucket_name: 'clickit-media' }],
    } as Record<string, unknown>,
  },
}

function mediaInput(over: Record<string, unknown> = {}) {
  return { whoami: whoamiOk, processEnv: {}, gitStatus: '', wranglerConfig: mediaConfig, env: 'r2', ...over }
}

function withR2Env(r2: Record<string, unknown>) {
  const config = structuredClone(mediaConfig)
  config.env.r2 = { ...config.env.r2, ...r2 }
  return config
}

test('checkMediaDeploy passes for env r2 with exactly one MEDIA_BUCKET binding', () => {
  const res = checkMediaDeploy(mediaInput())
  assert.deepEqual(res.reasons, [])
  assert.equal(res.ok, true)
})

test('checkMediaDeploy passes for the supabase-only env with no R2 binding', () => {
  const res = checkMediaDeploy(mediaInput({ env: 'supabase-only' }))
  assert.deepEqual(res.reasons, [])
  assert.equal(res.ok, true)
})

test('checkMediaDeploy refuses supabase-only when an R2 binding is present', () => {
  const config = structuredClone(mediaConfig)
  config.env['supabase-only'].r2_buckets = [{ binding: 'MEDIA_BUCKET', bucket_name: 'clickit-media' }]
  assert.equal(checkMediaDeploy(mediaInput({ wranglerConfig: config, env: 'supabase-only' })).ok, false)
})

test('checkMediaDeploy refuses an R2 binding at the top level for every env', () => {
  const config = { ...mediaConfig, r2_buckets: [{ binding: 'MEDIA_BUCKET', bucket_name: 'clickit-media' }] }
  assert.match(reasonsOf(checkMediaDeploy(mediaInput({ wranglerConfig: config }))), /top level/)
  assert.equal(checkMediaDeploy(mediaInput({ wranglerConfig: config, env: 'supabase-only' })).ok, false)
})

test('checkMediaDeploy refuses env r2 without its binding or when the env is missing', () => {
  assert.match(reasonsOf(checkMediaDeploy(mediaInput({ wranglerConfig: withR2Env({ r2_buckets: [] }) }))), /MEDIA_BUCKET/)
  const noEnv = structuredClone(mediaConfig) as unknown as { env: Record<string, unknown> }
  delete noEnv.env.r2
  assert.match(reasonsOf(checkMediaDeploy(mediaInput({ wranglerConfig: noEnv }))), /r2 env is not defined/)
})

test('checkMediaDeploy refuses an unknown, empty (top level) or missing env argument', () => {
  assert.equal(checkMediaDeploy(mediaInput({ env: 'staging' })).ok, false)
  assert.equal(checkMediaDeploy(mediaInput({ env: '' })).ok, false)
  assert.equal(checkMediaDeploy(mediaInput({ env: undefined })).ok, false)
})

test('checkMediaDeploy refuses a wrong whoami and an API token', () => {
  assert.equal(checkMediaDeploy(mediaInput({ whoami: whoamiOther })).ok, false)
  assert.equal(checkMediaDeploy(mediaInput({ processEnv: { CLOUDFLARE_API_TOKEN: 'x' } })).ok, false)
})

test('checkMediaDeploy refuses an account_id mismatch', () => {
  const res = checkMediaDeploy(mediaInput({ wranglerConfig: { ...mediaConfig, account_id: OTHER } }))
  assert.equal(res.ok, false)
  assert.match(reasonsOf(res), /account_id/)
})

test('checkMediaDeploy refuses the old MEDIA binding name and a wrong bucket', () => {
  const renamed = withR2Env({ r2_buckets: [{ binding: 'MEDIA', bucket_name: 'clickit-media' }] })
  assert.match(reasonsOf(checkMediaDeploy(mediaInput({ wranglerConfig: renamed }))), /MEDIA_BUCKET/)
  const wrongBucket = withR2Env({ r2_buckets: [{ binding: 'MEDIA_BUCKET', bucket_name: 'clickit-next-cache' }] })
  assert.equal(checkMediaDeploy(mediaInput({ wranglerConfig: wrongBucket })).ok, false)
})

test('checkMediaDeploy refuses a second R2 binding and other binding kinds', () => {
  const two = withR2Env({
    r2_buckets: [
      { binding: 'MEDIA_BUCKET', bucket_name: 'clickit-media' },
      { binding: 'OTHER', bucket_name: 'clickit-next-cache' },
    ],
  })
  assert.equal(checkMediaDeploy(mediaInput({ wranglerConfig: two })).ok, false)
  assert.equal(checkMediaDeploy(mediaInput({ wranglerConfig: { ...mediaConfig, kv_namespaces: [{ binding: 'K', id: 'x' }] } })).ok, false)
  assert.equal(checkMediaDeploy(mediaInput({ wranglerConfig: { ...mediaConfig, d1_databases: [{ binding: 'D' }] } })).ok, false)
  assert.equal(checkMediaDeploy(mediaInput({ wranglerConfig: withR2Env({ services: [{ binding: 'S', service: 'x' }] }) })).ok, false)
})

test('checkMediaDeploy refuses a missing SUPABASE_URL var', () => {
  const res = checkMediaDeploy(mediaInput({ wranglerConfig: withR2Env({ vars: {} }) }))
  assert.equal(res.ok, false)
  assert.match(reasonsOf(res), /SUPABASE_URL/)
})

test('checkMediaDeploy refuses a non-https SUPABASE_URL and unexpected vars', () => {
  assert.equal(
    checkMediaDeploy(mediaInput({ wranglerConfig: withR2Env({ vars: { SUPABASE_URL: 'http://127.0.0.1:55321' } }) })).ok,
    false,
  )
  assert.equal(
    checkMediaDeploy(mediaInput({ wranglerConfig: { ...mediaConfig, vars: { ...SUPA, LOCAL_DEV: '1' } } })).ok,
    false,
  )
})

test('checkMediaDeploy refuses non-empty cron triggers at top level or in the env', () => {
  assert.match(
    reasonsOf(checkMediaDeploy(mediaInput({ wranglerConfig: { ...mediaConfig, triggers: { crons: ['* * * * *'] } } }))),
    /crons/,
  )
  assert.equal(checkMediaDeploy(mediaInput({ wranglerConfig: withR2Env({ triggers: { crons: ['* * * * *'] } }) })).ok, false)
  const envCron = structuredClone(mediaConfig)
  envCron.env['supabase-only'].triggers = { crons: ['* * * * *'] }
  assert.equal(checkMediaDeploy(mediaInput({ wranglerConfig: envCron, env: 'supabase-only' })).ok, false)
})

test('checkMediaDeploy passes the real workers/media/wrangler.jsonc for every env', () => {
  const real = parseJsonc(readFileSync('workers/media/wrangler.jsonc', 'utf8'))
  for (const env of ['supabase-only', 'r2', 'r2-workersdev']) {
    const res = checkMediaDeploy(mediaInput({ wranglerConfig: real, env }))
    assert.deepEqual(res.reasons, [], env)
  }
})

test('checkMediaDeploy refuses a dirty tree', () => {
  const res = checkMediaDeploy(mediaInput({ gitStatus: '?? stray.txt\n' }))
  assert.equal(res.ok, false)
  assert.match(reasonsOf(res), /dirty/)
})

// ------------------------------------------- r2-workersdev (Step 28 option A, 2026-10-21)
// A separate Worker (clickit-media-r2) on workers.dev only. `routes` is inheritable in
// wrangler, so an env without an explicit [] would take media.clickitstory.ae.

function withWorkersdevEnv(over: Record<string, unknown> = {}) {
  const config = structuredClone(mediaConfig) as unknown as { env: Record<string, Record<string, unknown>> }
  config.env['r2-workersdev'] = {
    name: 'clickit-media-r2',
    workers_dev: true,
    routes: [],
    vars: { ...SUPA },
    r2_buckets: [{ binding: 'MEDIA_BUCKET', bucket_name: 'clickit-media' }],
    ...over,
  }
  return config
}

test('checkMediaDeploy passes env r2-workersdev: own name, no routes, workers.dev, one MEDIA_BUCKET', () => {
  const res = checkMediaDeploy(mediaInput({ wranglerConfig: withWorkersdevEnv(), env: 'r2-workersdev' }))
  assert.deepEqual(res.reasons, [])
})

test('checkMediaDeploy refuses r2-workersdev without an explicit empty routes array (would inherit the custom domain)', () => {
  const inherit = withWorkersdevEnv()
  delete inherit.env['r2-workersdev'].routes
  assert.match(reasonsOf(checkMediaDeploy(mediaInput({ wranglerConfig: inherit, env: 'r2-workersdev' }))), /routes/)
  const custom = withWorkersdevEnv({ routes: [{ pattern: 'media.clickitstory.ae', custom_domain: true }] })
  assert.match(reasonsOf(checkMediaDeploy(mediaInput({ wranglerConfig: custom, env: 'r2-workersdev' }))), /routes/)
  const single = withWorkersdevEnv({ route: 'media.clickitstory.ae/*' })
  assert.equal(checkMediaDeploy(mediaInput({ wranglerConfig: single, env: 'r2-workersdev' })).ok, false)
})

test('checkMediaDeploy refuses r2-workersdev named clickit-media, off workers.dev, or without its binding', () => {
  const named = withWorkersdevEnv({ name: 'clickit-media' })
  assert.match(reasonsOf(checkMediaDeploy(mediaInput({ wranglerConfig: named, env: 'r2-workersdev' }))), /clickit-media-r2/)
  const noDev = withWorkersdevEnv({ workers_dev: false })
  assert.match(reasonsOf(checkMediaDeploy(mediaInput({ wranglerConfig: noDev, env: 'r2-workersdev' }))), /workers_dev/)
  const noR2 = withWorkersdevEnv({ r2_buckets: [] })
  assert.match(reasonsOf(checkMediaDeploy(mediaInput({ wranglerConfig: noR2, env: 'r2-workersdev' }))), /MEDIA_BUCKET/)
})

test('checkMediaDeploy refuses env r2 or supabase-only renamed away from clickit-media', () => {
  assert.equal(checkMediaDeploy(mediaInput({ wranglerConfig: withR2Env({ name: 'clickit-media-r2' }) })).ok, false)
  const config = structuredClone(mediaConfig)
  config.env['supabase-only'].name = 'clickit-media-r2'
  assert.equal(checkMediaDeploy(mediaInput({ wranglerConfig: config, env: 'supabase-only' })).ok, false)
})

test('the real r2-workersdev env sets routes [] and the production envs keep media.clickitstory.ae', () => {
  const real = parseJsonc(readFileSync('workers/media/wrangler.jsonc', 'utf8'))
  assert.deepEqual(real.env['r2-workersdev'].routes, [])
  assert.equal(real.env['r2-workersdev'].name, 'clickit-media-r2')
  for (const env of ['supabase-only', 'r2']) {
    assert.deepEqual(real.env[env].routes, [{ pattern: 'media.clickitstory.ae', custom_domain: true }], env)
  }
})

test('isAllowedMediaOrigin accepts clickit-media-r2 on workers.dev and nothing looser', () => {
  assert.equal(isAllowedMediaOrigin('https://clickit-media-r2.clickitstory.workers.dev'), true)
  assert.equal(isAllowedMediaOrigin('https://clickit-media.clickitstory.workers.dev'), true)
  assert.equal(isAllowedMediaOrigin('https://media.clickitstory.ae'), true)
  for (const bad of [
    'https://clickit-media-r3.clickitstory.workers.dev',
    'https://clickit-media-r2x.clickitstory.workers.dev',
    'https://clickit-media-r2.clickitstory.workers.dev.evil.com',
    'http://clickit-media-r2.clickitstory.workers.dev',
    'https://clickit.clickitstory.workers.dev',
  ]) {
    assert.equal(isAllowedMediaOrigin(bad), false, bad)
  }
})

test('buildEnvFor workersdev verified accepts a clickit-media-r2 origin with a report made against it', () => {
  const origin = 'https://clickit-media-r2.clickitstory.workers.dev'
  const env = buildEnvFor(
    'workersdev',
    fileEnv,
    { mediaFlag: 'verified', mediaOrigin: origin, verifyReport: { ...goodReport, origin }, manifest },
    {},
  )
  assert.equal(env.NEXT_PUBLIC_MEDIA_CUTOVER_READY, 'verified')
  assert.equal(env.NEXT_PUBLIC_MEDIA_ORIGIN, origin)
})
