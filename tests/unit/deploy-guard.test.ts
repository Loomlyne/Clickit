import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  checkDeploy,
  checkMediaDeploy,
  checkVerifyReport,
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

const mediaConfig = {
  name: 'clickit-media',
  account_id: CLICKIT,
  triggers: { crons: [] },
  vars: { SUPABASE_URL: 'https://lajguozmtissnnfccmej.supabase.co' },
  r2_buckets: [{ binding: 'MEDIA_BUCKET', bucket_name: 'clickit-media' }],
  env: {
    'supabase-only': {
      name: 'clickit-media',
      vars: { SUPABASE_URL: 'https://lajguozmtissnnfccmej.supabase.co' },
      r2_buckets: [],
    },
  },
}

function mediaInput(over: Record<string, unknown> = {}) {
  return { whoami: whoamiOk, processEnv: {}, gitStatus: '', wranglerConfig: mediaConfig, env: '', ...over }
}

test('checkMediaDeploy passes for the top-level env with MEDIA_BUCKET and SUPABASE_URL', () => {
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
  config.env['supabase-only'].r2_buckets = [{ binding: 'MEDIA_BUCKET', bucket_name: 'clickit-media' }] as never
  assert.equal(checkMediaDeploy(mediaInput({ wranglerConfig: config, env: 'supabase-only' })).ok, false)
})

test('checkMediaDeploy refuses an unknown or missing env argument', () => {
  assert.equal(checkMediaDeploy(mediaInput({ env: 'staging' })).ok, false)
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
  const renamed = { ...mediaConfig, r2_buckets: [{ binding: 'MEDIA', bucket_name: 'clickit-media' }] }
  assert.match(reasonsOf(checkMediaDeploy(mediaInput({ wranglerConfig: renamed }))), /MEDIA_BUCKET/)
  const wrongBucket = { ...mediaConfig, r2_buckets: [{ binding: 'MEDIA_BUCKET', bucket_name: 'clickit-next-cache' }] }
  assert.equal(checkMediaDeploy(mediaInput({ wranglerConfig: wrongBucket })).ok, false)
})

test('checkMediaDeploy refuses a second R2 binding and other binding kinds', () => {
  const two = {
    ...mediaConfig,
    r2_buckets: [
      { binding: 'MEDIA_BUCKET', bucket_name: 'clickit-media' },
      { binding: 'OTHER', bucket_name: 'clickit-next-cache' },
    ],
  }
  assert.equal(checkMediaDeploy(mediaInput({ wranglerConfig: two })).ok, false)
  assert.equal(checkMediaDeploy(mediaInput({ wranglerConfig: { ...mediaConfig, kv_namespaces: [{ binding: 'K', id: 'x' }] } })).ok, false)
  assert.equal(checkMediaDeploy(mediaInput({ wranglerConfig: { ...mediaConfig, d1_databases: [{ binding: 'D' }] } })).ok, false)
  assert.equal(checkMediaDeploy(mediaInput({ wranglerConfig: { ...mediaConfig, services: [{ binding: 'S', service: 'x' }] } })).ok, false)
})

test('checkMediaDeploy refuses a missing SUPABASE_URL var', () => {
  const res = checkMediaDeploy(mediaInput({ wranglerConfig: { ...mediaConfig, vars: {} } }))
  assert.equal(res.ok, false)
  assert.match(reasonsOf(res), /SUPABASE_URL/)
})

test('checkMediaDeploy refuses a non-https SUPABASE_URL and unexpected vars', () => {
  assert.equal(
    checkMediaDeploy(mediaInput({ wranglerConfig: { ...mediaConfig, vars: { SUPABASE_URL: 'http://127.0.0.1:55321' } } })).ok,
    false,
  )
  assert.equal(
    checkMediaDeploy(mediaInput({ wranglerConfig: { ...mediaConfig, vars: { ...mediaConfig.vars, LOCAL_DEV: '1' } } })).ok,
    false,
  )
})

test('checkMediaDeploy refuses non-empty cron triggers at top level or in the env', () => {
  assert.match(
    reasonsOf(checkMediaDeploy(mediaInput({ wranglerConfig: { ...mediaConfig, triggers: { crons: ['* * * * *'] } } }))),
    /crons/,
  )
  const envCron = structuredClone(mediaConfig) as unknown as { env: Record<string, Record<string, unknown>> }
  envCron.env['supabase-only'].triggers = { crons: ['* * * * *'] }
  assert.equal(checkMediaDeploy(mediaInput({ wranglerConfig: envCron, env: 'supabase-only' })).ok, false)
})

test('checkMediaDeploy refuses a dirty tree', () => {
  const res = checkMediaDeploy(mediaInput({ gitStatus: '?? stray.txt\n' }))
  assert.equal(res.ok, false)
  assert.match(reasonsOf(res), /dirty/)
})
