import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  FOLDED_ENV_FILES,
  NEXT_ENV_MODULE_PATH,
  checkDeploy,
  checkEnvFiles,
  checkNextEnvModule,
  findFoldedEnvFiles,
} from '../../scripts/cf/deploy-guard.mjs'
// OpenNext's own code, loaded by file path (not a package export), so a version
// that reads more .env files or writes another format fails these tests.
import { extractProjectEnvVars } from '../../node_modules/@opennextjs/cloudflare/dist/cli/utils/extract-project-env-vars.js'
import { compileEnvFiles } from '../../node_modules/@opennextjs/cloudflare/dist/cli/build/open-next/compile-env-files.js'

// Review item 1: `opennextjs-cloudflare build` folds .env* files into
// .open-next/cloudflare/next-env.mjs and the Worker's init.js copies them into
// process.env at runtime. A deploy must never carry one.

const EMPTY_NEXT_ENV = 'export const production = {};\nexport const development = {};\nexport const test = {};\n'
const CANDIDATES = [
  ...FOLDED_ENV_FILES,
  '.env.example',
  '.env.preview.local',
  '.env.staging',
  '.dev.vars',
  '.dev.vars.example',
]

function fixture(files: Record<string, string>) {
  const dir = mkdtempSync(join(tmpdir(), 'cf-envfiles-'))
  for (const [name, text] of Object.entries(files)) writeFileSync(join(dir, name), text)
  return dir
}

test('FOLDED_ENV_FILES is exactly the set OpenNext reads for its three modes', () => {
  const files: Record<string, string> = {}
  CANDIDATES.forEach((name, i) => {
    files[name] = `V${i}=from-${name}\n`
  })
  const dir = fixture(files)
  try {
    const read = new Set<string>()
    for (const mode of ['production', 'development', 'test']) {
      const vars = extractProjectEnvVars(mode, { monorepoRoot: dir, appPath: dir }) as Record<string, string>
      CANDIDATES.forEach((name, i) => {
        if (vars[`V${i}`] !== undefined) read.add(name)
      })
    }
    assert.deepEqual([...read].sort(), [...FOLDED_ENV_FILES].sort())
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('the four files named in the review are in the refused set; .dev.vars and .env.example are not', () => {
  for (const name of ['.env', '.env.production', '.env.local', '.env.production.local']) {
    assert.ok(FOLDED_ENV_FILES.includes(name), name)
  }
  for (const name of ['.dev.vars', '.env.example', '.env.preview.local']) {
    assert.equal(FOLDED_ENV_FILES.includes(name), false, name)
  }
})

test('findFoldedEnvFiles lists only folded files present in the root', () => {
  const dir = fixture({
    '.env.local': 'A=1\n',
    '.env.production': 'B=\n',
    '.env.example': 'C=1\n',
    '.env.preview.local': 'D=1\n',
    '.dev.vars': 'E=1\n',
  })
  try {
    assert.deepEqual(findFoldedEnvFiles(dir).sort(), ['.env.local', '.env.production'])
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
  const clean = fixture({ '.env.example': 'C=1\n', '.dev.vars': 'E=1\n' })
  try {
    assert.deepEqual(findFoldedEnvFiles(clean), [])
  } finally {
    rmSync(clean, { recursive: true, force: true })
  }
})

test('checkEnvFiles passes an empty list and names every present file', () => {
  assert.deepEqual(checkEnvFiles([]), { ok: true, reasons: [] })
  const res = checkEnvFiles(['.env', '.env.local'])
  assert.equal(res.ok, false)
  const text = res.reasons.join(' | ')
  assert.match(text, /\.env\b/)
  assert.match(text, /\.env\.local/)
  assert.match(text, /move|remove/i)
})

test('NEXT_ENV_MODULE_PATH is where OpenNext writes next-env.mjs', () => {
  assert.equal(NEXT_ENV_MODULE_PATH, '.open-next/cloudflare/next-env.mjs')
})

test('checkNextEnvModule passes OpenNext output built with no .env files', () => {
  const app = fixture({ '.env.example': 'X=1\n', '.dev.vars': 'Y=1\n' })
  const out = mkdtempSync(join(tmpdir(), 'cf-nextenv-'))
  try {
    compileEnvFiles({ outputDir: out, monorepoRoot: app, appPath: app })
    const text = readFileSync(join(out, 'cloudflare', 'next-env.mjs'), 'utf8')
    assert.deepEqual(checkNextEnvModule(text), { ok: true, reasons: [] })
  } finally {
    rmSync(app, { recursive: true, force: true })
    rmSync(out, { recursive: true, force: true })
  }
})

test('checkNextEnvModule refuses OpenNext output built with a .env.local value and never prints it', () => {
  const app = fixture({ '.env.local': 'SUPABASE_SERVICE_ROLE_KEY=never-print-this-value\nEMPTY_ONE=\n' })
  const out = mkdtempSync(join(tmpdir(), 'cf-nextenv-'))
  try {
    compileEnvFiles({ outputDir: out, monorepoRoot: app, appPath: app })
    const text = readFileSync(join(out, 'cloudflare', 'next-env.mjs'), 'utf8')
    const res = checkNextEnvModule(text)
    assert.equal(res.ok, false)
    const joined = res.reasons.join(' | ')
    assert.match(joined, /SUPABASE_SERVICE_ROLE_KEY/)
    assert.equal(joined.includes('never-print-this-value'), false)
    assert.equal(joined.includes('EMPTY_ONE'), false)
  } finally {
    rmSync(app, { recursive: true, force: true })
    rmSync(out, { recursive: true, force: true })
  }
})

test('checkNextEnvModule accepts empty-string values only', () => {
  const ok = 'export const production = {"A":"","B":""};\nexport const development = {};\nexport const test = {};\n'
  assert.equal(checkNextEnvModule(ok).ok, true)
  const bad = 'export const production = {};\nexport const development = {"DEV_ONLY":"1"};\nexport const test = {};\n'
  const res = checkNextEnvModule(bad)
  assert.equal(res.ok, false)
  assert.match(res.reasons.join(' '), /DEV_ONLY/)
  assert.match(res.reasons.join(' '), /development/)
})

test('checkNextEnvModule refuses a missing file (cannot prove it is empty)', () => {
  for (const missing of [null, undefined]) {
    const res = checkNextEnvModule(missing)
    assert.equal(res.ok, false)
    assert.match(res.reasons.join(' '), /next-env\.mjs/)
    assert.match(res.reasons.join(' '), /missing/i)
  }
})

test('checkNextEnvModule refuses content it cannot parse, no exports, and non-object exports', () => {
  for (const text of [
    '',
    '// nothing here\n',
    'export const production = {};\nconsole.log(1)\n',
    'export const production = process.env;\n',
    'export const production = "x";\n',
    'export const production = ["x"];\n',
    'export const production = {"A":1};\n',
    'export const production = {"A":{"b":""}};\n',
    'export const production = {};\nexport default {"A":"x"};\n',
  ]) {
    assert.equal(checkNextEnvModule(text).ok, false, JSON.stringify(text))
  }
})

const CLICKIT = 'e329b099b6e4272fc0915a99832e47fe'
function baseDeploy(over: Record<string, unknown> = {}) {
  // Every other rule may fail here; these tests only look for the env reasons.
  return {
    whoami: `Account Name | Account ID\nClickitStory | ${CLICKIT}`,
    processEnv: {},
    stamp: null,
    headSha: 'x',
    gitStatus: '',
    originBranches: '',
    wranglerConfig: null,
    envFilesPresent: [],
    nextEnvText: EMPTY_NEXT_ENV,
    ...over,
  }
}

test('checkDeploy refuses when a folded .env file is in the repo root', () => {
  const res = checkDeploy(baseDeploy({ envFilesPresent: ['.env.production.local'] }))
  assert.equal(res.ok, false)
  assert.match(res.reasons.join(' | '), /\.env\.production\.local/)
})

test('checkDeploy refuses a built next-env.mjs with a value, or none at all', () => {
  const withValue = checkDeploy(baseDeploy({ nextEnvText: 'export const production = {"K":"v"};\n' }))
  assert.match(withValue.reasons.join(' | '), /next-env\.mjs/)
  const missing = checkDeploy(baseDeploy({ nextEnvText: null }))
  assert.match(missing.reasons.join(' | '), /next-env\.mjs/)
  const clean = checkDeploy(baseDeploy())
  assert.equal(/next-env\.mjs|\.env file/.test(clean.reasons.join(' | ')), false)
})

test('deploy.mjs checks the env files before the build and passes both inputs to checkDeploy', () => {
  const src = readFileSync('scripts/cf/deploy.mjs', 'utf8')
  const body = src.slice(src.indexOf('function deployWorkersdev('), src.indexOf('function deployMedia('))
  const preAt = body.indexOf('findFoldedEnvFiles(')
  const buildAt = body.indexOf("'scripts/cf/build-target.mjs'")
  assert.ok(preAt > 0 && preAt < buildAt, 'env files checked before the build')
  assert.match(body, /envFilesPresent: findFoldedEnvFiles\(/)
  assert.match(body, /nextEnvText/)
  assert.match(body, /NEXT_ENV_MODULE_PATH/)
})

test('build-target.mjs refuses folded env files before a workersdev build and checks next-env.mjs after it', () => {
  const src = readFileSync('scripts/cf/build-target.mjs', 'utf8')
  const main = src.slice(src.indexOf('function main('))
  const preAt = main.indexOf('findFoldedEnvFiles(')
  const buildAt = main.indexOf("['opennextjs-cloudflare', 'build']")
  const postAt = main.indexOf('checkNextEnvModule(')
  const stampAt = main.indexOf('writeFileSync(STAMP_PATH')
  assert.ok(preAt > 0 && preAt < buildAt, 'pre-build check')
  assert.ok(postAt > buildAt && postAt < stampAt, 'post-build check before the stamp')
})
